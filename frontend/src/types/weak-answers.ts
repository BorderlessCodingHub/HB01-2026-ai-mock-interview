import type { ReviewPriority } from "@/types/review-items";

export type AnswerEvaluation =
  | "incorrect"
  | "incomplete"
  | "insufficient"
  | "satisfactory";

export type WeakAnswer = {
  id: string;
  sessionId: string;
  question: string;
  userAnswer: string;
  evaluation: AnswerEvaluation;
  feedback: string;
  topic: string;
  priority: ReviewPriority;
  createdAt: string;
};

export type ListWeakAnswersResponse = {
  weakAnswers: WeakAnswer[];
};
