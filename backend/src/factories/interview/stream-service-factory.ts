import { makeTokenUsageService } from "@/factories/token-usage/token-usage-service-factory";
import * as reviewGenerationQueue from "@/infrastructure/queue/review-generation-queue";
import { add as addWeakAnswerJob } from "@/infrastructure/queue/weak-answer-queue";
import { MessageRepository } from "@/modules/interview/repository/message-repository";
import { ReviewRepository } from "@/modules/interview/repository/review-repository";
import { SessionRepository } from "@/modules/interview/repository/session-repository";
import { InterviewStreamService } from "@/modules/interview/service/stream-service";
import { ResumeRepository } from "@/modules/resumes/repository/resume-repository";

import { makeInterviewGraph } from "./interview-graph-factory";

export function makeInterviewStreamService(): InterviewStreamService {
  return new InterviewStreamService(
    new SessionRepository(),
    new MessageRepository(),
    new ResumeRepository(),
    makeInterviewGraph(),
    reviewGenerationQueue,
    { add: addWeakAnswerJob },
    makeTokenUsageService(),
    new ReviewRepository(),
  );
}
