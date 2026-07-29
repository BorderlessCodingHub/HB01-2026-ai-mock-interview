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
  reviewItemId: string;
  topic: string;
  currentPriority: ReviewPriority;
  suggestedStatus: ReviewItemStatus | null;
  suggestedPriority: ReviewPriority | null;
  confirmedStatus: ReviewItemStatus | null;
  confirmedPriority: ReviewPriority | null;
  turns: ReviewSessionTurn[];
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
  items: ReviewSessionItemReport[];
};

export type CreateReviewSessionResponse = {
  id: string;
  status: "in_progress";
  items: Array<{
    id: string;
    reviewItemId: string;
    topic: string;
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

/** SSE meta — evaluation complete */
export type ReviewSessionStreamMetaComplete = {
  status: "pending_review";
  report: Array<{
    reviewSessionItemId: string;
    reviewItemId: string;
    topic: string;
    currentPriority: ReviewPriority;
    suggestedStatus: ReviewItemStatus | null;
    suggestedPriority: ReviewPriority | null;
  }>;
};

export type ReviewSessionStreamMeta =
  | ReviewSessionStreamMetaProgress
  | ReviewSessionStreamMetaComplete;

export type ApplyReviewSessionItem = {
  reviewSessionItemId: string;
  status: ReviewItemStatus;
  priority?: ReviewPriority;
};

export type ApplyReviewSessionRequest = {
  items: ApplyReviewSessionItem[];
};
