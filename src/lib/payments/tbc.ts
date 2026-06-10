import { PaymentProviderKey } from "../../models/Payment";
import {
  CreateOrderParams,
  CreateOrderResult,
  OrderStatus,
  PaymentProvider,
  RecurringChargeParams,
} from "./types";

/**
 * TBC Bank — E-Commerce / tpay.
 *
 * NOTE: endpoint paths and field names below are the documented shape but MUST
 * be confirmed against your TBC merchant dashboard after onboarding (sandbox
 * credentials are issued there). Everything marked TODO needs that check.
 */
const BASE = process.env.TBC_API_BASE || "https://api.tbcbank.ge/v1/tpay";
const API_KEY = process.env.TBC_API_KEY || "";
const CLIENT_ID = process.env.TBC_CLIENT_ID || "";
const CLIENT_SECRET = process.env.TBC_CLIENT_SECRET || "";

// money helper: our minor units (tetri) -> TBC decimal major units
const toMajor = (minor: number) => Number((minor / 100).toFixed(2));

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const res = await fetch(`${BASE}/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", apikey: API_KEY },
    body: new URLSearchParams({ client_Id: CLIENT_ID, client_secret: CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`TBC token request failed: ${res.status}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

async function authHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: API_KEY,
    Authorization: `Bearer ${await getToken()}`,
  };
}

export const tbcProvider: PaymentProvider = {
  key: PaymentProviderKey.TBC,

  async createOrder(p: CreateOrderParams): Promise<CreateOrderResult> {
    const res = await fetch(`${BASE}/payments`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        amount: { currency: p.currency, total: toMajor(p.amount) },
        returnurl: p.returnUrl,
        callbackUrl: p.callbackUrl,
        merchantPaymentId: p.orderId,
        description: p.description,
        // save-card / recurring opt-in (TODO: confirm field + saveCardToDate format MMYY)
        saveCard: p.saveCard,
        saveCardToDate: p.saveCard ? "1230" : undefined,
      }),
    });
    if (!res.ok) throw new Error(`TBC createOrder failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { payId: string; _links?: { redirect?: { href?: string } } };
    const redirectUrl = data._links?.redirect?.href;
    if (!data.payId || !redirectUrl) throw new Error("TBC createOrder: missing payId/redirect");
    return { providerOrderId: data.payId, redirectUrl };
  },

  async getStatus(providerOrderId: string): Promise<OrderStatus> {
    const res = await fetch(`${BASE}/payments/${providerOrderId}`, { headers: await authHeaders() });
    if (!res.ok) throw new Error(`TBC getStatus failed: ${res.status}`);
    const data = (await res.json()) as {
      status?: string;
      recurringCard?: { recId?: string; cardMask?: string; expiryDate?: string };
    };
    return {
      paid: data.status === "Succeeded",
      status: data.status ?? "Unknown",
      recurringToken: data.recurringCard?.recId ?? null,
      cardMask: data.recurringCard?.cardMask ?? null,
      expiry: data.recurringCard?.expiryDate ?? null,
      raw: data,
    };
  },

  async chargeRecurring(p: RecurringChargeParams): Promise<OrderStatus> {
    // TODO: confirm recurring-execution endpoint (e.g. /payments/execution).
    const res = await fetch(`${BASE}/payments/execution`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        recId: p.recurringToken,
        amount: { currency: p.currency, total: toMajor(p.amount) },
        merchantPaymentId: p.orderId,
        description: p.description,
      }),
    });
    if (!res.ok) throw new Error(`TBC chargeRecurring failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { status?: string };
    return { paid: data.status === "Succeeded", status: data.status ?? "Unknown", raw: data };
  },

  // TBC does not sign callbacks — authenticity comes from the getStatus() re-fetch.
  verifyCallback(): boolean {
    return true;
  },

  parseCallbackOrderId(body: unknown, query: Record<string, unknown>): string | null {
    const b = (body ?? {}) as { payId?: string; PaymentId?: string };
    return b.payId ?? b.PaymentId ?? (query.payId as string) ?? null;
  },
};
