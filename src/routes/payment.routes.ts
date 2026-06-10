import { Router } from "express";
import rateLimit from "express-rate-limit";
import { createCheckout, handleCallback, getPaymentStatus } from "../controllers/payment.controller";
import { mockBankPage, mockSetOutcome } from "../controllers/payment-mock.controller";
import { authenticate, requireRole } from "../middleware/auth";
import { Role } from "../models/User";

const router = Router();

// Local fake-bank routes — mounted only in PAYMENT_MOCK mode. Registered first
// so they cannot be shadowed by the /:id/status pattern.
if (process.env.PAYMENT_MOCK === "1") {
  router.get("/mock/pay", mockBankPage);
  router.post("/mock/set", mockSetOutcome);
}

const checkoutLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many checkout attempts, please try again later" },
});

// Owner starts a subscription checkout
router.post("/checkout", checkoutLimiter, authenticate, requireRole(Role.RESTAURANT_OWNER), createCheckout);

// Owner polls a payment (fallback for missed callbacks)
router.get("/:id/status", authenticate, getPaymentStatus);

// Bank webhooks — public, authenticity enforced by signature + status re-fetch
router.post("/callback/:provider", handleCallback);

export default router;
