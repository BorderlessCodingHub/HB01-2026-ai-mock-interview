import { makeReviewMergeService } from "@/factories/interview/review-merge-service-factory";
import { makeSessionQuotaService } from "@/factories/session-quota/session-quota-service-factory";
import { ReviewRepository } from "@/modules/interview/repository/review-repository";
import { ReviewSessionRepository } from "@/modules/review-sessions/repository/review-session-repository";
import { ReviewSessionsService } from "@/modules/review-sessions/service/review-sessions-service";

export function makeReviewSessionsService(): ReviewSessionsService {
  return new ReviewSessionsService(
    new ReviewRepository(),
    new ReviewSessionRepository(),
    makeReviewMergeService(),
    makeSessionQuotaService(),
  );
}
