export type InterviewLevel = "entry" | "mid" | "senior";

export type InterviewLocale = "en" | "pt";

export const MAX_JOB_DESCRIPTION_LENGTH = 5_000;

export type CreateSessionInput = {
  resumeId: string;
  level: InterviewLevel;
  interviewLocale: InterviewLocale;
  jobDescription?: string;
  turns?: number;
};

/** Highest number of turns selectable per level; mirrors the backend's MAX_TURNS_BY_LEVEL - 1. */
export const MAX_TURNS_BY_LEVEL: Record<InterviewLevel, number> = {
  entry: 5,
  mid: 7,
  senior: 8,
};

export const MIN_INTERVIEW_TURNS = 3;

export type ReviewGenerationStatus = "idle" | "pending" | "ready" | "failed";

export type SessionSummary = {
  id: string;
  resumeId: string;
  level: InterviewLevel;
  turnCount: number;
  maxTurns: number;
  isFinished: boolean;
  hasJobDescription: boolean;
  createdAt: string;
  reviewGenerationStatus: ReviewGenerationStatus;
  reviewGenerationError: string | null;
};

export type SessionMessage = {
  id: string;
  role: "human" | "ai";
  content: string;
  createdAt: string;
};

export type ListSessionsResponse = {
  sessions: SessionSummary[];
};

export type CreateSessionResponse = {
  id: string;
};

export type ListMessagesResponse = {
  messages: SessionMessage[];
  hasMore: boolean;
};

export type StreamMeta = {
  turnCount: number;
  maxTurns: number;
  isFinished: boolean;
  /** Present on final turn only */
  reviewGenerationStatus?: "pending" | "failed";
};

export type FeedbackRating = "up" | "down";

export type SubmitFeedbackInput = {
  rating: FeedbackRating;
  comment?: string;
};

export type InterviewFeedback = {
  id: string;
  sessionId: string;
  userId: number;
  rating: FeedbackRating;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};
