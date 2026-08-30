import { resumeUploadMiddleware } from "@/modules/resumes/middlewares/resume-upload-middleware";
import { asyncHandler } from "@/shared";
import type { Router } from "express";

import { makeResumesController } from "@/factories/resumes/resumes-controller-factory";
import { makeAiRateLimiter } from "@/factories/shared/ai-rate-limiter-factory";

const aiRateLimiter = makeAiRateLimiter();

export default function resumesRoutes(router: Router): void {
  const controller = makeResumesController();

  router.post(
    "/",
    aiRateLimiter,
    resumeUploadMiddleware.single("file"),
    asyncHandler(controller.upload),
  );
  router.get("/", asyncHandler(controller.list));
  router.get("/:id/file", asyncHandler(controller.getFile));
  router.get("/:id", asyncHandler(controller.getById));
  router.delete("/:id", asyncHandler(controller.delete));
}
