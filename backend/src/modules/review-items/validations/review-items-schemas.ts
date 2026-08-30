import { reviewPrioritySchema } from "@/modules/interview/validations/interview-schemas";
import { reviewItemStatusSchema } from "@/modules/review-sessions/validations/review-session-schemas";
import { z } from "zod";

export const reviewItemResponseSchema = z.object({
  id: z.uuid(),
  sessionId: z.uuid().nullable(),
  topic: z.string(),
  angle: z.string(),
  description: z.string(),
  priority: reviewPrioritySchema,
  status: reviewItemStatusSchema,
  learnedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const listReviewItemsResponseSchema = z.object({
  reviewItems: z.array(reviewItemResponseSchema),
});

export const patchReviewItemSchema = z.object({
  status: reviewItemStatusSchema,
});

export const listReviewItemsQuerySchema = z.object({
  status: z.enum(["active", "learned", "all"]).default("active"),
});

export type ReviewItemResponse = z.infer<typeof reviewItemResponseSchema>;
export type ListReviewItemsResponse = z.infer<
  typeof listReviewItemsResponseSchema
>;
export type PatchReviewItemInput = z.infer<typeof patchReviewItemSchema>;
export type ListReviewItemsQuery = z.infer<typeof listReviewItemsQuerySchema>;
