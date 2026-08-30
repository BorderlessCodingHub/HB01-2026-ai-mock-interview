import type { InterviewLocale } from "./interview";
import type { ReviewItemStatus, ReviewPriority } from "./review-items";

export type ReviewSessionStatus = "in_progress" | "pending_review" | "completed";

export type CreateReviewSessionInput = {
  reviewItemIds: string[];
  interviewLocale: InterviewLocale;
};

export type ReviewSessionTurn = {
  question: string;
  answer: string;
};

export type ReviewSessionItemReport = {
  id: string;
  reviewItemId: string | null;
  topic: string;
  angle: string;
  currentPriority: ReviewPriority;
  suggestedStatus: ReviewItemStatus | null;
  suggestedPriority: ReviewPriority | null;
  confirmedStatus: ReviewItemStatus | null;
  confirmedPriority: ReviewPriority | null;
  turns: ReviewSessionTurn[];
  wentWell: string[];
  workOn: string[];
};

export type ReviewSessionSummary = {
  id: string;
  status: ReviewSessionStatus;
  topics: string[];
  createdAt: string;
  completedAt: string | null;
};

export type ListReviewSessionsResponse = {
  sessions: ReviewSessionSummary[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ReviewSession = {
  id: string;
  status: ReviewSessionStatus;
  interviewLocale: InterviewLocale;
  items: ReviewSessionItemReport[];
};

export type CreateReviewSessionResponse = {
  id: string;
  status: "in_progress";
  items: Array<{
    id: string;
    reviewItemId: string;
    topic: string;
    angle: string;
    currentPriority: ReviewPriority;
  }>;
};

/** SSE meta — in-progress turn */
export type ReviewSessionStreamMetaProgress = {
  reviewSessionItemId: string;
  itemIndex: number;
  totalItems: number;
  turnsCompleted: number;
  questionsPerItem: number;
  status: "in_progress";
};

/** SSE meta — evaluation in flight */
export type ReviewSessionStreamMetaEvaluating = {
  status: "evaluating";
};

/** SSE meta — evaluation complete */
export type ReviewSessionStreamMetaComplete = {
  status: "pending_review";
  interviewLocale: InterviewLocale;
  report: Array<{
    reviewSessionItemId: string;
    reviewItemId: string | null;
    topic: string;
    angle: string;
    currentPriority: ReviewPriority;
    suggestedStatus: ReviewItemStatus | null;
    suggestedPriority: ReviewPriority | null;
    wentWell: string[];
    workOn: string[];
  }>;
};

export type ReviewSessionStreamMeta =
  | ReviewSessionStreamMetaProgress
  | ReviewSessionStreamMetaEvaluating
  | ReviewSessionStreamMetaComplete;

export type ApplyReviewSessionItem = {
  reviewSessionItemId: string;
  status: ReviewItemStatus;
  priority?: ReviewPriority;
};

export type ApplyReviewSessionRequest = {
  items: ApplyReviewSessionItem[];
};
