import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type { InterviewLocale } from "@/shared";
import type {
  ReviewItemStatus,
  ReviewSessionStatus,
} from "../../../../prisma/generated/client";

export type ReviewSessionTurn = {
  question: string;
  answer: string;
};

export type ReviewSessionItemRecord = {
  id: string;
  reviewSessionId: string;
  reviewItemId: string | null;
  order: number;
  topic: string;
  angle: string;
  description: string;
  currentPriority: ReviewPriority;
  turns: ReviewSessionTurn[];
  pendingQuestion: string | null;
  suggestedStatus: ReviewItemStatus | null;
  suggestedPriority: ReviewPriority | null;
  wentWell: string[];
  workOn: string[];
  confirmedStatus: ReviewItemStatus | null;
  confirmedPriority: ReviewPriority | null;
  confirmedAt: Date | null;
  createdAt: Date;
};

export type ReviewSessionRecord = {
  id: string;
  userId: number;
  status: ReviewSessionStatus;
  interviewLocale: InterviewLocale;
  createdAt: Date;
  evaluatedAt: Date | null;
  completedAt: Date | null;
  items: ReviewSessionItemRecord[];
};
