import { PaymentProviderKey } from "../../models/Payment";
import { PaymentProvider } from "./types";
import { tbcProvider } from "./tbc";
import { bogProvider } from "./bog";
import { mockProvider } from "./mock";

const providers: Record<PaymentProviderKey, PaymentProvider> = {
  [PaymentProviderKey.TBC]: tbcProvider,
  [PaymentProviderKey.BOG]: bogProvider,
};

export function getProvider(key: PaymentProviderKey): PaymentProvider {
  // Local testing: swap in the mock bank for every key (no real credentials).
  if (process.env.PAYMENT_MOCK === "1") return mockProvider;
  const p = providers[key];
  if (!p) throw new Error(`Unknown payment provider: ${key}`);
  return p;
}

/** Normalise a route/string param to a provider key (case-insensitive). */
export function parseProviderKey(value: string): PaymentProviderKey | null {
  const upper = value.toUpperCase();
  return upper === PaymentProviderKey.TBC || upper === PaymentProviderKey.BOG
    ? (upper as PaymentProviderKey)
    : null;
}

export * from "./types";
