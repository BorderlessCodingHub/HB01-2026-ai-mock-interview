import { describe, expect, it } from "vitest";

import {
  listReviewItemsQuerySchema,
  listReviewItemsResponseSchema,
  patchReviewItemSchema,
  reviewItemResponseSchema,
} from "./review-items-schemas";

const validReviewItemId = "550e8400-e29b-41d4-a716-446655440000";
const validSessionId = "660e8400-e29b-41d4-a716-446655440001";

const validReviewItem = {
  id: validReviewItemId,
  sessionId: validSessionId,
  topic: "System design trade-offs",
  angle: "caching strategy comparison",
  description: "Candidate struggled to compare caching strategies.",
  priority: "high" as const,
  status: "active" as const,
  learnedAt: null,
  createdAt: "2026-05-30T12:00:00.000Z",
  updatedAt: "2026-05-30T12:30:00.000Z",
};

describe("reviewItemResponseSchema", () => {
  it("accepts a valid review item", () => {
    const result = reviewItemResponseSchema.safeParse(validReviewItem);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validReviewItem);
    }
  });

  it.each(["low", "medium", "high"] as const)(
    "accepts priority %s",
    (priority) => {
      const result = reviewItemResponseSchema.safeParse({
        ...validReviewItem,
        priority,
      });

      expect(result.success).toBe(true);
    },
  );

  it("rejects invalid id", () => {
    const result = reviewItemResponseSchema.safeParse({
      ...validReviewItem,
      id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid sessionId", () => {
    const result = reviewItemResponseSchema.safeParse({
      ...validReviewItem,
      sessionId: "invalid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid priority", () => {
    const result = reviewItemResponseSchema.safeParse({
      ...validReviewItem,
      priority: "critical",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid createdAt datetime", () => {
    const result = reviewItemResponseSchema.safeParse({
      ...validReviewItem,
      createdAt: "not-a-datetime",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const { topic: _topic, ...withoutTopic } = validReviewItem;
    const result = reviewItemResponseSchema.safeParse(withoutTopic);

    expect(result.success).toBe(false);
  });
});

describe("listReviewItemsResponseSchema", () => {
  it("accepts a valid list of review items", () => {
    const result = listReviewItemsResponseSchema.safeParse({
      reviewItems: [validReviewItem],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewItems).toHaveLength(1);
      expect(result.data.reviewItems[0]).toEqual(validReviewItem);
    }
  });

  it("accepts an empty reviewItems array", () => {
    const result = listReviewItemsResponseSchema.safeParse({
      reviewItems: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid item inside reviewItems", () => {
    const result = listReviewItemsResponseSchema.safeParse({
      reviewItems: [
        {
          ...validReviewItem,
          priority: "urgent",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing reviewItems field", () => {
    const result = listReviewItemsResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("patchReviewItemSchema", () => {
  it.each(["active", "learned"] as const)("accepts status %s", (status) => {
    const result = patchReviewItemSchema.safeParse({ status });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ status });
    }
  });

  it("rejects invalid status values", () => {
    const result = patchReviewItemSchema.safeParse({ status: "pending" });

    expect(result.success).toBe(false);
  });

  it("rejects missing status", () => {
    const result = patchReviewItemSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("listReviewItemsQuerySchema", () => {
  it.each(["active", "learned", "all"] as const)(
    "accepts status %s",
    (status) => {
      const result = listReviewItemsQuerySchema.safeParse({ status });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe(status);
      }
    },
  );

  it("defaults status to active when omitted", () => {
    const result = listReviewItemsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("rejects invalid status values", () => {
    const result = listReviewItemsQuerySchema.safeParse({
      status: "pending",
    });

    expect(result.success).toBe(false);
  });
});
