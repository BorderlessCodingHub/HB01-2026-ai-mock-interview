import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, messagesStateReducer } from "@langchain/langgraph";

import type { InterviewLevel } from "@/modules/interview/validations/interview-schemas";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";
import type { InterviewLocale } from "@/shared/interview-locale/interview-locale";

export const InterviewGraphStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  turnCount: Annotation<number>,
  maxTurns: Annotation<number>,
  level: Annotation<InterviewLevel>,
  userId: Annotation<number>,
  resumeSummary: Annotation<StructuredSummary>,
  jobDescription: Annotation<string | null>(),
  interviewLocale: Annotation<InterviewLocale>,
  isFinished: Annotation<boolean>,
  runReview: Annotation<boolean>,
  coveredAngles: Annotation<{ topic: string; angle: string }[]>,
});

export type InterviewGraphState = typeof InterviewGraphStateAnnotation.State;

export type CreateInitialInterviewStateParams = {
  messages?: BaseMessage[];
  turnCount: number;
  maxTurns: number;
  level: InterviewLevel;
  userId: number;
  resumeSummary: StructuredSummary;
  interviewLocale: InterviewLocale;
  jobDescription?: string | null;
  isFinished?: boolean;
  runReview?: boolean;
  coveredAngles?: { topic: string; angle: string }[];
};

export function createInitialInterviewState(
  params: CreateInitialInterviewStateParams,
): InterviewGraphState {
  return {
    messages: params.messages ?? [],
    turnCount: params.turnCount,
    maxTurns: params.maxTurns,
    level: params.level,
    userId: params.userId,
    resumeSummary: params.resumeSummary,
    jobDescription: params.jobDescription ?? null,
    interviewLocale: params.interviewLocale,
    isFinished: params.isFinished ?? false,
    runReview: params.runReview ?? false,
    coveredAngles: params.coveredAngles ?? [],
  };
}
