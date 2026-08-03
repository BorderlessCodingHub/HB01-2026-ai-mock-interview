import { z } from "zod";

import { interviewLocaleSchema } from "@/shared";

export const interviewLevelSchema = z.enum(["entry", "mid", "senior"]);

export const createSessionSchema = z.object({
  resumeId: z.uuid({ message: "Invalid resume ID" }),
  level: interviewLevelSchema,
  interviewLocale: interviewLocaleSchema,
  jobDescription: z
    .string()
    .trim()
    .max(5_000, "Job description is too long")
    .optional(),
});

export const streamMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content is required")
    .max(10_000, "Message content is too long"),
  interviewLocale: interviewLocaleSchema,
});

export const reviewPrioritySchema = z.enum(["low", "medium", "high"]);

const reviewItemSchema = z.object({
  topic: z.string().trim().min(1, "Topic is required"),
  angle: z.string().trim().min(1, "Angle is required"),
  description: z.string().trim().min(1, "Description is required"),
  priority: reviewPrioritySchema,
});

export const reviewItemsGeneratorOutputSchema = z.object({
  items: z.array(reviewItemSchema),
});

export const answerEvaluationSchema = z.enum([
  "incorrect",
  "incomplete",
  "insufficient",
  "satisfactory",
]);

const weakAnswerItemSchema = z.object({
  question: z.string().trim().min(1, "Question is required"),
  userAnswer: z.string().trim().min(1, "User answer is required"),
  evaluation: answerEvaluationSchema,
  feedback: z.string().trim().min(1, "Feedback is required"),
  topic: z.string().trim().min(1, "Topic is required"),
  priority: reviewPrioritySchema,
});

export const weakAnswersGeneratorOutputSchema = z.object({
  items: z.array(weakAnswerItemSchema),
});

const topicCoverageItemSchema = z.object({
  topic: z.string().trim().min(1).max(120),
  angle: z.string().trim().min(1).max(200),
});

export const topicCoverageGeneratorOutputSchema = z.object({
  items: z.array(topicCoverageItemSchema).max(8),
});

export const feedbackRatingSchema = z.enum(["up", "down"]);

export const submitFeedbackSchema = z.object({
  rating: feedbackRatingSchema,
  comment: z.string().max(1000).optional(),
});

export type InterviewLevel = z.infer<typeof interviewLevelSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type StreamMessageInput = z.infer<typeof streamMessageSchema>;
export type ReviewPriority = z.infer<typeof reviewPrioritySchema>;
export type ReviewItemsGeneratorOutput = z.infer<
  typeof reviewItemsGeneratorOutputSchema
>;
export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;
export type WeakAnswerItem = z.infer<typeof weakAnswerItemSchema>;
export type WeakAnswersGeneratorOutput = z.infer<
  typeof weakAnswersGeneratorOutputSchema
>;
export type TopicCoverageItem = z.infer<typeof topicCoverageItemSchema>;
export type TopicCoverageGeneratorOutput = z.infer<
  typeof topicCoverageGeneratorOutputSchema
>;
export type FeedbackRating = z.infer<typeof feedbackRatingSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
