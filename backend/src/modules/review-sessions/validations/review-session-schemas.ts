import { z } from "zod";

import { reviewPrioritySchema } from "@/modules/interview/validations/interview-schemas";
import { interviewLocaleSchema } from "@/shared";

export const reviewItemStatusSchema = z.enum(["active", "learned"]);

export const reviewSessionStatusSchema = z.enum([
  "in_progress",
  "pending_review",
  "completed",
]);

function parseCommaStatuses(
  value: string,
  ctx: z.RefinementCtx,
): string[] {
  const tokens = value.split(",").map((token) => token.trim());
  if (tokens.some((token) => token.length === 0)) {
    ctx.addIssue({
      code: "custom",
      message: "Empty status token",
    });
    return z.NEVER;
  }
  return tokens;
}

export const listReviewSessionsQuerySchema = z.object({
  status: z
    .string()
    .transform(parseCommaStatuses)
    .pipe(z.array(reviewSessionStatusSchema).min(1)),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const createReviewSessionSchema = z.object({
  reviewItemIds: z
    .array(z.uuid())
    .min(1, "Select at least one review item")
    .max(10, "Select at most 10 review items per session")
    .refine((ids) => new Set(ids).size === ids.length, "Duplicate item IDs"),
  interviewLocale: interviewLocaleSchema,
});

export const reviewSessionStreamBodySchema = z.object({
  answer: z.string().trim().min(1).max(4_000).optional(),
  interviewLocale: interviewLocaleSchema,
});

const applyReviewSessionItemSchema = z.object({
  reviewSessionItemId: z.uuid(),
  status: reviewItemStatusSchema,
  priority: reviewPrioritySchema.optional(),
});

export const applyReviewSessionSchema = z
  .object({
    items: z.array(applyReviewSessionItemSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const ids = data.items.map((item) => item.reviewSessionItemId);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        message: "Duplicate item IDs",
        path: ["items"],
      });
    }

    for (const [index, item] of data.items.entries()) {
      if (item.status === "active" && item.priority === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "Priority is required when status is active",
          path: ["items", index, "priority"],
        });
      }
    }
  });

// Flat object schema — OpenAI structured output rejects oneOf/discriminatedUnion.
export const reviewSessionEvaluationOutputSchema = z
  .object({
    status: reviewItemStatusSchema,
    priority: reviewPrioritySchema.nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "active" && data.priority === null) {
      ctx.addIssue({
        code: "custom",
        message: "Priority is required when status is active",
        path: ["priority"],
      });
    }

    if (data.status === "learned" && data.priority !== null) {
      ctx.addIssue({
        code: "custom",
        message: "Priority must be null when status is learned",
        path: ["priority"],
      });
    }
  });

export type ReviewSessionEvaluationOutput = z.infer<
  typeof reviewSessionEvaluationOutputSchema
>;
export type CreateReviewSessionInput = z.infer<
  typeof createReviewSessionSchema
>;
export type ReviewSessionStreamBodyInput = z.infer<
  typeof reviewSessionStreamBodySchema
>;
export type ApplyReviewSessionInput = z.infer<typeof applyReviewSessionSchema>;
export type ListReviewSessionsQuery = z.infer<
  typeof listReviewSessionsQuerySchema
>;
