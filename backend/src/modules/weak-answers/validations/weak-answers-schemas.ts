import {
  answerEvaluationSchema,
  reviewPrioritySchema,
} from "@/modules/interview/validations/interview-schemas";
import { z } from "zod";

export const weakAnswerResponseSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid().nullable(),
  question: z.string(),
  userAnswer: z.string(),
  evaluation: answerEvaluationSchema,
  feedback: z.string(),
  topic: z.string(),
  priority: reviewPrioritySchema,
  createdAt: z.iso.datetime(),
});

export const listWeakAnswersResponseSchema = z.object({
  weakAnswers: z.array(weakAnswerResponseSchema),
});

export type WeakAnswerResponse = z.infer<typeof weakAnswerResponseSchema>;
export type ListWeakAnswersResponse = z.infer<
  typeof listWeakAnswersResponseSchema
>;
