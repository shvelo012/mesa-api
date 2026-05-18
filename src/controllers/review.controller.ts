import { Response } from "express";
import { Op } from "sequelize";
import { AuthRequest } from "../middleware/auth";
import { Review } from "../models/Review";
import { Restaurant } from "../models/Restaurant";
import { Reservation, ReservationStatus } from "../models/Reservation";
import { TableModel } from "../models/Table";
import { Floor } from "../models/Floor";
import { User } from "../models/User";

export async function listReviews(req: AuthRequest, res: Response) {
  try {
    const restaurant = await Restaurant.findByPk(req.params.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }

    const reviews = await Review.findAll({
      where: { restaurantId: req.params.id },
      include: [{ model: User, attributes: ["id", "name"] }],
      order: [["createdAt", "DESC"]],
    });

    const avg = reviews.length
      ? reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length
      : null;

    res.json({ reviews, avgStars: avg ? Math.round(avg * 10) / 10 : null, count: reviews.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
}

export async function createReview(req: AuthRequest, res: Response) {
  try {
    const { stars, text } = req.body;
    const userId = req.user!.userId;
    const restaurantId = req.params.id;

    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      res.status(400).json({ error: "stars must be integer 1–5" });
      return;
    }

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }

    const completedReservation = await Reservation.findOne({
      where: {
        userId,
        status: ReservationStatus.COMPLETED,
      },
      include: [
        {
          model: TableModel,
          required: true,
          include: [
            {
              model: Floor,
              required: true,
              where: { restaurantId },
            },
          ],
        },
      ],
    });

    if (!completedReservation) {
      res.status(403).json({ error: "Must have a completed reservation at this restaurant to review" });
      return;
    }

    const existing = await Review.findOne({ where: { userId, restaurantId } });
    if (existing) {
      res.status(409).json({ error: "Already reviewed this restaurant. Use PATCH to edit once." });
      return;
    }

    const review = await Review.create({ userId, restaurantId, stars, text: text ?? null });
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: "Failed to create review" });
  }
}

export async function editReview(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    if (review.userId !== userId) {
      res.status(403).json({ error: "Not your review" });
      return;
    }
    if (review.edited) {
      res.status(403).json({ error: "Review already edited once — no further edits allowed" });
      return;
    }

    const { stars, text } = req.body;
    if (stars !== undefined && (!Number.isInteger(stars) || stars < 1 || stars > 5)) {
      res.status(400).json({ error: "stars must be integer 1–5" });
      return;
    }

    await review.update({
      ...(stars !== undefined && { stars }),
      ...(text !== undefined && { text }),
      edited: true,
    });

    res.json(review);
  } catch (err) {
    res.status(500).json({ error: "Failed to edit review" });
  }
}

export async function deleteReview(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const review = await Review.findByPk(req.params.id);

    if (!review) {
      res.status(404).json({ error: "Review not found" });
      return;
    }
    if (review.userId !== userId) {
      res.status(403).json({ error: "Not your review" });
      return;
    }

    await review.destroy();
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete review" });
  }
}

export async function myReviews(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const reviews = await Review.findAll({
      where: { userId },
      include: [{ model: Restaurant, attributes: ["id", "name", "slug"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
}
