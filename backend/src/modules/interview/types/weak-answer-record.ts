import type {
  AnswerEvaluation,
  ReviewPriority,
} from "@/modules/interview/validations/interview-schemas";

export type WeakAnswerRecord = {
  id: string;
  userId: number;
  sessionId: string | null;
  question: string;
  userAnswer: string;
  evaluation: AnswerEvaluation;
  feedback: string;
  topic: string;
  priority: ReviewPriority;
  createdAt: Date;
};
