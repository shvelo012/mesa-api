import { Request, Response } from "express";
import { z } from "zod";
import { sequelize } from "../lib/database";
import { AuthRequest, getRestaurantForUser } from "../middleware/auth";
import { Plan } from "../models/Plan";
import { Subscription, SubscriptionStatus } from "../models/Subscription";
import { Payment, PaymentKind, PaymentStatus, PaymentProviderKey } from "../models/Payment";
import { PaymentMethod } from "../models/PaymentMethod";
import { getProvider, parseProviderKey } from "../lib/payments";
import { encryptSecret, decryptSecret } from "../lib/crypto";
import { logAudit } from "../lib/audit";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
// Public base URL of THIS API — must be reachable by the bank for callbacks.
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "http://localhost:4000";
const PERIOD_MS = 30 * 86400000; // 30-day billing period

const checkoutSchema = z.object({
  planId: z.string().uuid(),
  provider: z.enum([PaymentProviderKey.TBC, PaymentProviderKey.BOG]),
});

/**
 * Owner: start a subscription checkout.
 * Creates a PENDING payment, opens a hosted order at the chosen bank with
 * save-card enabled, and returns the redirect URL for the browser.
 */
export async function createCheckout(req: AuthRequest, res: Response) {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const plan = await Plan.findByPk(parsed.data.planId);
  if (!plan || !plan.isActive) { res.status(404).json({ error: "Plan not found" }); return; }

  const provider = getProvider(parsed.data.provider);

  const payment = await Payment.create({
    restaurantId: restaurant.id,
    planId: plan.id,
    provider: provider.key,
    amount: plan.priceMonthly, // minor units (tetri)
    currency: "GEL",
    status: PaymentStatus.PENDING,
    kind: PaymentKind.INITIAL,
  });

  try {
    const order = await provider.createOrder({
      amount: plan.priceMonthly,
      currency: "GEL",
      orderId: payment.id,
      description: `Mesa — ${plan.name} subscription`,
      saveCard: true,
      returnUrl: `${FRONTEND_URL}/billing?payment=${payment.id}`,
      // use the REQUESTED key so the callback path is stable even under PAYMENT_MOCK
      callbackUrl: `${API_PUBLIC_URL}/api/payments/callback/${parsed.data.provider.toLowerCase()}`,
    });
    await payment.update({ providerOrderId: order.providerOrderId });
    logAudit({ userId: req.user!.userId, action: "PAYMENT_CHECKOUT", resourceType: "payment", resourceId: payment.id, metadata: { provider: provider.key, planId: plan.id }, ip: req.ip });
    res.status(201).json({ paymentId: payment.id, redirectUrl: order.redirectUrl });
  } catch (err) {
    await payment.update({ status: PaymentStatus.FAILED });
    throw err; // forwarded to the global error handler
  }
}

/**
 * Public webhook hit by the bank. We verify the signature (BOG), then re-fetch
 * the authoritative status, then settle idempotently. Always ACK 200.
 */
export async function handleCallback(req: Request, res: Response) {
  const key = parseProviderKey(req.params.provider);
  if (!key) { res.status(404).json({ error: "Unknown provider" }); return; }
  const provider = getProvider(key);

  const rawBody: Buffer = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
  if (!provider.verifyCallback(rawBody, req.headers)) {
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  const providerOrderId = provider.parseCallbackOrderId(req.body, req.query as Record<string, unknown>);
  if (!providerOrderId) { res.status(400).json({ error: "Missing order id" }); return; }

  const payment = await Payment.findOne({ where: { providerOrderId } });
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }

  // Authoritative status — never trust the callback body's claimed status.
  const status = await provider.getStatus(providerOrderId);

  await settlePayment(payment.id, status, key);
  res.json({ received: true });
}

/**
 * Owner: poll our record of a payment (fallback for missed callbacks).
 * Re-syncs from the bank if still pending.
 */
export async function getPaymentStatus(req: AuthRequest, res: Response) {
  const restaurant = await getRestaurantForUser(req.user!.userId);
  if (!restaurant) { res.status(404).json({ error: "No restaurant found" }); return; }

  const payment = await Payment.findOne({ where: { id: req.params.id, restaurantId: restaurant.id } });
  if (!payment) { res.status(404).json({ error: "Payment not found" }); return; }

  if (payment.status === PaymentStatus.PENDING && payment.providerOrderId) {
    const provider = getProvider(payment.provider);
    const status = await provider.getStatus(payment.providerOrderId);
    await settlePayment(payment.id, status, payment.provider);
    await payment.reload();
  }

  res.json({ id: payment.id, status: payment.status, amount: payment.amount, currency: payment.currency });
}

/**
 * Idempotent settlement. Locks the payment row; only a PENDING payment can
 * transition. On success: save the recurring card token + activate the
 * subscription. Safe to call repeatedly (duplicate callbacks, poll + webhook).
 */
async function settlePayment(paymentId: string, status: { paid: boolean; status: string; recurringToken?: string | null; cardMask?: string | null; expiry?: string | null; raw: unknown }, key: PaymentProviderKey) {
  await sequelize.transaction(async (t) => {
    const payment = await Payment.findByPk(paymentId, { lock: true, transaction: t });
    if (!payment || payment.status !== PaymentStatus.PENDING) return; // already settled

    await payment.update({ rawCallback: status.raw }, { transaction: t });

    if (!status.paid) {
      await payment.update({ status: PaymentStatus.FAILED }, { transaction: t });
      return;
    }

    // Persist saved-card token for future auto-renewal (encrypted at rest).
    if (status.recurringToken) {
      await PaymentMethod.create({
        restaurantId: payment.restaurantId,
        provider: key,
        recurringToken: encryptSecret(status.recurringToken),
        cardMask: status.cardMask ?? null,
        expiry: status.expiry ?? null,
        isActive: true,
      }, { transaction: t });
    }

    const periodEnd = new Date(Date.now() + PERIOD_MS);
    const existing = await Subscription.findOne({
      where: { restaurantId: payment.restaurantId },
      order: [["createdAt", "DESC"]],
      transaction: t,
    });

    let subscriptionId: string;
    if (existing) {
      await existing.update({
        planId: payment.planId ?? existing.planId,
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
        cancelledAt: null,
      }, { transaction: t });
      subscriptionId = existing.id;
    } else {
      const created = await Subscription.create({
        restaurantId: payment.restaurantId,
        planId: payment.planId,
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
      }, { transaction: t });
      subscriptionId = created.id;
    }

    await payment.update({ status: PaymentStatus.PAID, subscriptionId }, { transaction: t });
    logAudit({ action: "PAYMENT_PAID", resourceType: "payment", resourceId: payment.id, metadata: { provider: key, subscriptionId } });
  });
}

/**
 * Auto-renewal: charge the saved card for one subscription and extend its
 * period. Intended to be invoked by a scheduler (node-cron / external cron)
 * for subscriptions whose currentPeriodEnd is due. Not wired to a scheduler
 * here — call it from your cron job.
 */
export async function chargeSubscriptionRenewal(subscriptionId: string): Promise<PaymentStatus> {
  const sub = await Subscription.findByPk(subscriptionId, { include: [Plan] });
  if (!sub) throw new Error("Subscription not found");

  const method = await PaymentMethod.findOne({
    where: { restaurantId: sub.restaurantId, isActive: true },
    order: [["createdAt", "DESC"]],
  });
  if (!method) {
    await sub.update({ status: SubscriptionStatus.PAST_DUE });
    return PaymentStatus.FAILED;
  }

  const plan = sub.plan;
  const amount = plan?.priceMonthly ?? 0;
  const provider = getProvider(method.provider);

  const payment = await Payment.create({
    restaurantId: sub.restaurantId,
    planId: sub.planId,
    subscriptionId: sub.id,
    provider: method.provider,
    amount,
    currency: "GEL",
    status: PaymentStatus.PENDING,
    kind: PaymentKind.RECURRING,
  });

  try {
    const result = await provider.chargeRecurring({
      amount,
      currency: "GEL",
      orderId: payment.id,
      recurringToken: decryptSecret(method.recurringToken),
      description: `Mesa — ${plan?.name ?? "subscription"} renewal`,
    });
    if (result.paid) {
      await payment.update({ status: PaymentStatus.PAID, rawCallback: result.raw });
      await sub.update({ status: SubscriptionStatus.ACTIVE, currentPeriodEnd: new Date(Date.now() + PERIOD_MS) });
      return PaymentStatus.PAID;
    }
    await payment.update({ status: PaymentStatus.FAILED, rawCallback: result.raw });
    await sub.update({ status: SubscriptionStatus.PAST_DUE });
    return PaymentStatus.FAILED;
  } catch (err) {
    await payment.update({ status: PaymentStatus.FAILED });
    await sub.update({ status: SubscriptionStatus.PAST_DUE });
    throw err;
  }
}
