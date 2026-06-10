/**
 * End-to-end payment test against a PAYMENT_MOCK server. No bank credentials.
 *
 * Run:
 *   Terminal 1:  PAYMENT_MOCK=1 npm run dev
 *   Terminal 2:  npm run test:payments
 *   (or point at another port:  TEST_API_URL=http://localhost:4101/api npm run test:payments)
 *
 * Covers: checkout -> mock pay -> callback -> settle -> subscription ACTIVE,
 * saved-card stored, callback idempotency, decline path, recurring renewal.
 * Creates its own throwaway data and deletes it at the end.
 */
process.env.PAYMENT_MOCK = "1"; // for the in-process renewal call
import "reflect-metadata";
import "dotenv/config";
import { sequelize } from "../src/lib/database";
import { User, Role } from "../src/models/User";
import { Restaurant } from "../src/models/Restaurant";
import { Plan } from "../src/models/Plan";
import { Subscription, SubscriptionStatus } from "../src/models/Subscription";
import { Payment, PaymentStatus, PaymentKind } from "../src/models/Payment";
import { PaymentMethod } from "../src/models/PaymentMethod";
import { signAccess } from "../src/lib/jwt";
import { chargeSubscriptionRenewal } from "../src/controllers/payment.controller";

const API = process.env.TEST_API_URL || "http://localhost:4000/api";
const ts = Date.now();

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name}  ${detail}`); }
}

async function main() {
  await sequelize.authenticate();

  // ── setup throwaway owner + restaurant + plan ──
  const owner = await User.create({
    email: `paytest+${ts}@example.com`, password: "x", name: "Pay Test",
    role: Role.RESTAURANT_OWNER, emailVerified: true,
  });
  const restaurant = await Restaurant.create({
    slug: `paytest-${ts}`, name: "Pay Test Diner", address: "1 Test St",
    phone: "+995555000000", email: `r${ts}@example.com`, openTime: "09:00", closeTime: "23:00",
    ownerId: owner.id,
  });
  const plan = await Plan.create({
    slug: `paytest-plan-${ts}`, name: "Pay Test Plan", priceMonthly: 2500, isActive: true,
  });
  const token = signAccess({ userId: owner.id, role: Role.RESTAURANT_OWNER });
  const authHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };

  console.log(`\nAPI: ${API}\n— success path —`);

  // 1) checkout
  const coRes = await fetch(`${API}/payments/checkout`, {
    method: "POST", headers: authHeaders,
    body: JSON.stringify({ planId: plan.id, provider: "TBC" }),
  });
  const co = await coRes.json() as { paymentId: string; redirectUrl: string };
  check("checkout returns 201", coRes.status === 201, `got ${coRes.status}`);
  check("redirectUrl points at mock bank", co.redirectUrl?.includes("/payments/mock/pay"), co.redirectUrl);
  const order = `mock_${co.paymentId}`;

  // 2) simulate user clicking "Pay" on the fake-bank page
  await fetch(`${API}/payments/mock/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order, paid: true }) });
  const cbRes = await fetch(`${API}/payments/callback/tbc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payId: order }) });
  check("callback acked 200", cbRes.status === 200, `got ${cbRes.status}`);

  // 3) status + side effects
  const stRes = await fetch(`${API}/payments/${co.paymentId}/status`, { headers: authHeaders });
  const st = await stRes.json() as { status: string };
  check("payment status PAID", st.status === PaymentStatus.PAID, st.status);

  const sub = await Subscription.findOne({ where: { restaurantId: restaurant.id } });
  check("subscription ACTIVE", sub?.status === SubscriptionStatus.ACTIVE, sub?.status);
  check("period end in future", !!sub?.currentPeriodEnd && sub.currentPeriodEnd > new Date());

  const pmCount1 = await PaymentMethod.count({ where: { restaurantId: restaurant.id } });
  const pm = await PaymentMethod.findOne({ where: { restaurantId: restaurant.id } });
  check("saved card stored", pmCount1 === 1, `count=${pmCount1}`);
  check("recurring token encrypted at rest", !!pm && pm.recurringToken.startsWith("enc:"));

  // 4) idempotency — replay the callback
  console.log("— idempotency —");
  await fetch(`${API}/payments/callback/tbc`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payId: order }) });
  const st2 = await (await fetch(`${API}/payments/${co.paymentId}/status`, { headers: authHeaders })).json() as { status: string };
  check("still PAID after replay", st2.status === PaymentStatus.PAID, st2.status);
  check("no duplicate saved card", (await PaymentMethod.count({ where: { restaurantId: restaurant.id } })) === 1);
  check("still one subscription", (await Subscription.count({ where: { restaurantId: restaurant.id } })) === 1);

  // 5) decline path
  console.log("— decline path —");
  const co2 = await (await fetch(`${API}/payments/checkout`, { method: "POST", headers: authHeaders, body: JSON.stringify({ planId: plan.id, provider: "BOG" }) })).json() as { paymentId: string };
  const order2 = `mock_${co2.paymentId}`;
  await fetch(`${API}/payments/mock/set`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: order2, paid: false }) });
  await fetch(`${API}/payments/callback/bog`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order_id: order2 }) });
  const st3 = await (await fetch(`${API}/payments/${co2.paymentId}/status`, { headers: authHeaders })).json() as { status: string };
  check("declined payment FAILED", st3.status === PaymentStatus.FAILED, st3.status);
  check("subscription unchanged after decline", (await Subscription.findOne({ where: { restaurantId: restaurant.id } }))?.status === SubscriptionStatus.ACTIVE);

  // 6) recurring renewal (in-process, uses the saved card via mock)
  console.log("— recurring renewal —");
  const before = (await Subscription.findByPk(sub!.id))!.currentPeriodEnd!;
  const result = await chargeSubscriptionRenewal(sub!.id);
  const after = (await Subscription.findByPk(sub!.id))!.currentPeriodEnd!;
  check("renewal charge PAID", result === PaymentStatus.PAID, result);
  check("period extended", after > before);
  check("recurring payment row created", (await Payment.count({ where: { subscriptionId: sub!.id, kind: PaymentKind.RECURRING, status: PaymentStatus.PAID } })) >= 1);

  // ── cleanup ──
  await Payment.destroy({ where: { restaurantId: restaurant.id } });
  await PaymentMethod.destroy({ where: { restaurantId: restaurant.id } });
  await Subscription.destroy({ where: { restaurantId: restaurant.id } });
  await restaurant.destroy({ force: true });
  await owner.destroy({ force: true });
  await plan.destroy();

  console.log(`\n${fail === 0 ? "PASS" : "FAIL"} — ${pass} passed, ${fail} failed\n`);
  await sequelize.close();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("test crashed:", e); process.exit(1); });
