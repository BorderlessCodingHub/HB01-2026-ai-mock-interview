import {
  applyReviewSessionSchema,
  createReviewSessionSchema,
  reviewSessionStreamBodySchema,
} from "@/modules/review-sessions/validations/review-session-schemas";
import { asyncHandler, validate } from "@/shared";
import type { Router } from "express";

import { makeAiRateLimiter } from "@/factories/shared/ai-rate-limiter-factory";
import { makeReviewSessionsController } from "@/factories/review-sessions/review-sessions-controller-factory";

export default function reviewSessionsRoutes(router: Router): void {
  const controller = makeReviewSessionsController();
  const aiRateLimiter = makeAiRateLimiter();

  router.post(
    "/",
    validate(createReviewSessionSchema),
    asyncHandler(controller.create),
  );
  router.get("/", asyncHandler(controller.list));
  router.post(
    "/:id/stream",
    aiRateLimiter,
    validate(reviewSessionStreamBodySchema),
    asyncHandler(controller.stream),
  );
  router.get("/:id", asyncHandler(controller.getById));
  router.post(
    "/:id/apply",
    validate(applyReviewSessionSchema),
    asyncHandler(controller.apply),
  );
}
