import { PaymentProviderKey } from "../../models/Payment";

export interface CreateOrderParams {
  amount: number; // minor units (tetri)
  currency: string; // "GEL"
  orderId: string; // our Payment.id — echoed back so we can match callbacks
  description: string;
  saveCard: boolean; // request a reusable recurring token for auto-renewal
  returnUrl: string; // browser redirect target after payment (display only)
  callbackUrl: string; // server-to-server webhook
}

export interface CreateOrderResult {
  providerOrderId: string;
  redirectUrl: string;
}

export interface OrderStatus {
  paid: boolean;
  status: string; // raw provider status string
  // Present once a save-card payment settles — store this to charge later.
  recurringToken?: string | null;
  cardMask?: string | null;
  expiry?: string | null;
  raw: unknown;
}

export interface RecurringChargeParams {
  amount: number;
  currency: string;
  orderId: string; // our Payment.id
  recurringToken: string;
  description: string;
}

/**
 * One interface, two banks. The controller/routes never branch on provider —
 * they resolve a provider by key and call these methods.
 */
export interface PaymentProvider {
  key: PaymentProviderKey;

  /** Create a hosted-checkout order. Returns the bank order id + redirect URL. */
  createOrder(p: CreateOrderParams): Promise<CreateOrderResult>;

  /** Authoritative status fetch. NEVER trust the browser redirect — call this. */
  getStatus(providerOrderId: string): Promise<OrderStatus>;

  /** Charge a previously saved card with no user interaction (renewals). */
  chargeRecurring(p: RecurringChargeParams): Promise<OrderStatus>;

  /**
   * Verify an incoming webhook is genuinely from the bank.
   * BOG signs callbacks (RSA-SHA256); TBC does not — for TBC we rely on the
   * authoritative getStatus() re-fetch instead.
   */
  verifyCallback(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean;

  /** Pull the provider order id out of a callback body/query so we can match it. */
  parseCallbackOrderId(body: unknown, query: Record<string, unknown>): string | null;
}
