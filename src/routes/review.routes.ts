import { Router } from "express";
import { listReviews, createReview, editReview, deleteReview, myReviews } from "../controllers/review.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Nested under /api/restaurants/:id/reviews
export const restaurantReviewRouter = Router({ mergeParams: true });
restaurantReviewRouter.get("/", listReviews);
restaurantReviewRouter.post("/", authenticate, createReview);

// Standalone /api/reviews
router.get("/me", authenticate, myReviews);
router.patch("/:id", authenticate, editReview);
router.delete("/:id", authenticate, deleteReview);

export default router;
