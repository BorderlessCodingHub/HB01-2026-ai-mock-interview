import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type {
  ActiveReviewTopicItem,
  RecentCoverageItem,
} from "@/modules/interview/prompts/interviewer-system-prompt";
import type { InterviewLevel } from "@/modules/interview/validations/interview-schemas";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";
import type { LlmUsage } from "@/modules/token-usage/types/llm-usage";
import type { InterviewLocale } from "@/shared/interview-locale/interview-locale";

export type InterviewGraphStreamToken = {
  content: string;
};

/** Final AI message read from the graph checkpointer after the stream completes. */
export type InterviewGraphStreamCompletion = {
  content: string;
  langGraphMessageId?: string;
  usage?: LlmUsage;
};

export type InterviewGraphInput = {
  messages: { role: "human"; content: string }[];
  turnCount: number;
  maxTurns: number;
  level: InterviewLevel;
  userId: number;
  resumeSummary: StructuredSummary;
  jobDescription?: string | null;
  interviewLocale: InterviewLocale;
  isFinished: boolean;
  runReview: boolean;
  recentCoverage?: RecentCoverageItem[];
  activeReviewTopics?: ActiveReviewTopicItem[];
  coveredAngles?: RecentCoverageItem[];
};

export type InterviewGraphStreamOptions = {
  threadId: string;
  callbacks?: BaseCallbackHandler[];
};

export interface IInterviewGraph {
  streamMessages(
    input: InterviewGraphInput,
    options: InterviewGraphStreamOptions,
  ): AsyncGenerator<
    InterviewGraphStreamToken,
    InterviewGraphStreamCompletion | undefined
  >;
}
