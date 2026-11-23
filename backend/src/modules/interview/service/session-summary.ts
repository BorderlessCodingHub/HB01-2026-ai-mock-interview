import type { InterviewSessionWithFeedback } from "@/modules/interview/repository/session-repository";
import type {
  FeedbackRating,
  InterviewLevel,
} from "@/modules/interview/validations/interview-schemas";

/** The owner's rating of a session, or `null` when they have not rated it yet. */
export type SessionFeedbackSummary = {
  rating: FeedbackRating;
  comment: string | null;
  updatedAt: Date;
};

export type SessionSummary = {
  id: string;
  resumeId: string | null;
  resumeName: string;
  level: InterviewLevel;
  turnCount: number;
  maxTurns: number;
  isFinished: boolean;
  hasJobDescription: boolean;
  createdAt: Date;
  reviewGenerationStatus: "idle" | "pending" | "ready" | "failed";
  reviewGenerationError: string | null;
  feedback: SessionFeedbackSummary | null;
};

export function toSessionSummary(
  session: InterviewSessionWithFeedback,
): SessionSummary {
  const ownFeedback = session.interviewFeedbacks[0];

  return {
    id: session.id,
    resumeId: session.resumeId,
    resumeName: session.resumeName,
    level: session.level,
    turnCount: session.turnCount,
    maxTurns: session.maxTurns,
    isFinished: session.isFinished,
    hasJobDescription: session.jobDescription != null,
    createdAt: session.createdAt,
    reviewGenerationStatus: session.reviewGenerationStatus,
    reviewGenerationError: session.reviewGenerationError,
    feedback: ownFeedback
      ? {
          rating: ownFeedback.rating,
          comment: ownFeedback.comment,
          updatedAt: ownFeedback.updatedAt,
        }
      : null,
  };
}
