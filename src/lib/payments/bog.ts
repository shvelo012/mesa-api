import crypto from "crypto";
import { PaymentProviderKey } from "../../models/Payment";
import {
  CreateOrderParams,
  CreateOrderResult,
  OrderStatus,
  PaymentProvider,
  RecurringChargeParams,
} from "./types";

/**
 * Bank of Georgia — E-Commerce payments API.
 *
 * NOTE: endpoints/fields are the documented shape; confirm against your BOG
 * merchant dashboard after onboarding. BOG_PUBLIC_KEY is the PEM BOG publishes
 * for callback signature verification.
 */
const AUTH_URL = process.env.BOG_AUTH_URL || "https://oauth2.bog.ge/auth/realms/bog/protocol/openid-connect/token";
const BASE = process.env.BOG_API_BASE || "https://api.bog.ge/payments/v1";
const CLIENT_ID = process.env.BOG_CLIENT_ID || "";
const CLIENT_SECRET = process.env.BOG_CLIENT_SECRET || "";
// PEM public key for verifying the Callback-Signature header. Newlines may be
// escaped in env, so unescape them.
const PUBLIC_KEY = (process.env.BOG_PUBLIC_KEY || "").replace(/\\n/g, "\n");

const toMajor = (minor: number) => Number((minor / 100).toFixed(2));

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) throw new Error(`BOG token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function authHeaders() {
  return {
    "Content-Type": "application/json",
    "Accept-Language": "ka",
    Authorization: `Bearer ${await getToken()}`,
  };
}

export const bogProvider: PaymentProvider = {
  key: PaymentProviderKey.BOG,

  async createOrder(p: CreateOrderParams): Promise<CreateOrderResult> {
    const res = await fetch(`${BASE}/ecommerce/orders`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        callback_url: p.callbackUrl,
        external_order_id: p.orderId,
        purchase_units: {
          currency: p.currency,
          total_amount: toMajor(p.amount),
          basket: [
            { product_id: "subscription", description: p.description, quantity: 1, unit_price: toMajor(p.amount) },
          ],
        },
        redirect_urls: { success: p.returnUrl, fail: p.returnUrl },
        // save-card / automatic-payments opt-in (TODO: confirm exact flag)
        ...(p.saveCard ? { application_type: "web", config: { save_card: true } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`BOG createOrder failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { id: string; _links?: { redirect?: { href?: string } } };
    const redirectUrl = data._links?.redirect?.href;
    if (!data.id || !redirectUrl) throw new Error("BOG createOrder: missing id/redirect");
    return { providerOrderId: data.id, redirectUrl };
  },

  async getStatus(providerOrderId: string): Promise<OrderStatus> {
    const res = await fetch(`${BASE}/receipt/${providerOrderId}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`BOG getStatus failed: ${res.status}`);
    const data = (await res.json()) as {
      order_status?: { key?: string };
      payment_detail?: { card_token?: string; card_number?: string; card_expiry_date?: string };
    };
    return {
      paid: data.order_status?.key === "completed",
      status: data.order_status?.key ?? "unknown",
      recurringToken: data.payment_detail?.card_token ?? null,
      cardMask: data.payment_detail?.card_number ?? null,
      expiry: data.payment_detail?.card_expiry_date ?? null,
      raw: data,
    };
  },

  async chargeRecurring(p: RecurringChargeParams): Promise<OrderStatus> {
    // BOG automatic payments charge against the saved-card token (the original
    // order id). TODO: confirm subscription/automatic-payment endpoint.
    const res = await fetch(`${BASE}/ecommerce/orders/${p.recurringToken}/subscription`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        external_order_id: p.orderId,
        purchase_units: { currency: p.currency, total_amount: toMajor(p.amount) },
      }),
    });
    if (!res.ok) throw new Error(`BOG chargeRecurring failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { order_status?: { key?: string } };
    return { paid: data.order_status?.key === "completed", status: data.order_status?.key ?? "unknown", raw: data };
  },

  verifyCallback(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const sig = headers["callback-signature"];
    if (!sig || !PUBLIC_KEY) return false;
    try {
      const verifier = crypto.createVerify("RSA-SHA256");
      verifier.update(rawBody);
      verifier.end();
      return verifier.verify(PUBLIC_KEY, Buffer.from(String(sig), "base64"));
    } catch {
      return false;
    }
  },

  parseCallbackOrderId(body: unknown): string | null {
    // BOG wraps the order payload under `body` in its callback envelope.
    const b = (body ?? {}) as { order_id?: string; body?: { order_id?: string } };
    return b.body?.order_id ?? b.order_id ?? null;
  },
};
