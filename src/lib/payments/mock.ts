import { PaymentProviderKey } from "../../models/Payment";
import {
  CreateOrderParams,
  CreateOrderResult,
  OrderStatus,
  PaymentProvider,
  RecurringChargeParams,
} from "./types";

/**
 * Mock bank — local end-to-end testing with NO real credentials.
 * Active only when PAYMENT_MOCK=1. createOrder redirects to a local fake-bank
 * page (mountable mock routes) where you click Pay/Decline; that page sets an
 * outcome here and fires the normal callback. The rest of the system runs
 * unchanged, so the full flow (settle, save card, activate sub, renew) is real.
 */
const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "http://localhost:4000";

// providerOrderId -> paid? (default true). Set by the fake-bank page.
const outcomes = new Map<string, boolean>();

export function setMockOutcome(providerOrderId: string, paid: boolean) {
  outcomes.set(providerOrderId, paid);
}

export const mockProvider: PaymentProvider = {
  key: PaymentProviderKey.TBC, // unused for mock — callback path comes from the request

  async createOrder(p: CreateOrderParams): Promise<CreateOrderResult> {
    const providerOrderId = `mock_${p.orderId}`;
    // real provider key rides in the callbackUrl (.../callback/<tbc|bog>)
    const providerSeg = p.callbackUrl.split("/").pop() || "tbc";
    const redirectUrl =
      `${API_PUBLIC_URL}/api/payments/mock/pay` +
      `?order=${encodeURIComponent(providerOrderId)}` +
      `&provider=${encodeURIComponent(providerSeg)}` +
      `&return=${encodeURIComponent(p.returnUrl)}`;
    return { providerOrderId, redirectUrl };
  },

  async getStatus(providerOrderId: string): Promise<OrderStatus> {
    const paid = outcomes.get(providerOrderId) ?? true;
    return {
      paid,
      status: paid ? "completed" : "failed",
      recurringToken: paid ? `mockcard_${providerOrderId}` : null,
      cardMask: paid ? "****4242" : null,
      expiry: paid ? "12/30" : null,
      raw: { mock: true, providerOrderId, paid },
    };
  },

  async chargeRecurring(p: RecurringChargeParams): Promise<OrderStatus> {
    // saved-card auto-charge always succeeds in the mock
    return { paid: true, status: "completed", raw: { mock: true, recurring: true, orderId: p.orderId } };
  },

  verifyCallback(): boolean {
    return true;
  },

  parseCallbackOrderId(body: unknown, query: Record<string, unknown>): string | null {
    const b = (body ?? {}) as { payId?: string; order_id?: string; body?: { order_id?: string } };
    return b.payId ?? b.order_id ?? b.body?.order_id ?? (query.order as string) ?? null;
  },
};
