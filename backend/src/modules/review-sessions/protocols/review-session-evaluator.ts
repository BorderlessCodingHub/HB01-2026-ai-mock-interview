import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";

import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type { ReviewSessionEvaluationOutput } from "@/modules/review-sessions/validations/review-session-schemas";
import type { InterviewLocale } from "@/shared";

export type ReviewSessionTurn = {
  question: string;
  answer: string;
};

export type ReviewSessionEvaluationInput = {
  topic: string;
  angle: string;
  description: string;
  currentPriority: ReviewPriority;
  turns: ReviewSessionTurn[];
  interviewLocale: InterviewLocale;
};

export type ReviewSessionEvaluatorOptions = {
  callbacks?: BaseCallbackHandler[];
};

export interface IReviewSessionEvaluator {
  evaluate(
    input: ReviewSessionEvaluationInput,
    options?: ReviewSessionEvaluatorOptions,
  ): Promise<ReviewSessionEvaluationOutput>;
}
