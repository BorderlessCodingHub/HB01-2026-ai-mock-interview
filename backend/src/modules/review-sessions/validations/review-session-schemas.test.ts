import { describe, expect, it } from "vitest";

import {
  applyReviewSessionSchema,
  createReviewSessionSchema,
  listReviewSessionsQuerySchema,
  reviewItemStatusSchema,
  reviewSessionEvaluationOutputSchema,
  reviewSessionStatusSchema,
  reviewSessionStreamBodySchema,
} from "./review-session-schemas";

const reviewItemId1 = "550e8400-e29b-41d4-a716-446655440001";

describe("reviewItemStatusSchema", () => {
  it.each(["active", "learned"] as const)("accepts %s", (status) => {
    expect(reviewItemStatusSchema.parse(status)).toBe(status);
  });

  it("rejects unknown status values", () => {
    expect(() => reviewItemStatusSchema.parse("pending")).toThrow();
  });
});

describe("reviewSessionStatusSchema", () => {
  it.each(["in_progress", "pending_review", "completed"] as const)(
    "accepts %s",
    (status) => {
      expect(reviewSessionStatusSchema.parse(status)).toBe(status);
    },
  );

  it("rejects unknown status values", () => {
    expect(() => reviewSessionStatusSchema.parse("cancelled")).toThrow();
  });
});

describe("createReviewSessionSchema", () => {
  it("accepts a single valid review item id with interviewLocale", () => {
    const result = createReviewSessionSchema.safeParse({
      reviewItemIds: [reviewItemId1],
      interviewLocale: "en",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        reviewItemIds: [reviewItemId1],
        interviewLocale: "en",
      });
    }
  });

  it.each(["en", "pt"] as const)(
    "accepts interviewLocale %s",
    (interviewLocale) => {
      const result = createReviewSessionSchema.safeParse({
        reviewItemIds: [reviewItemId1],
        interviewLocale,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interviewLocale).toBe(interviewLocale);
      }
    },
  );

  it("accepts up to 10 unique review item ids", () => {
    const reviewItemIds = Array.from({ length: 10 }, (_, index) =>
      `550e8400-e29b-41d4-a716-4466554400${String(index).padStart(2, "0")}`,
    );

    const result = createReviewSessionSchema.safeParse({
      reviewItemIds,
      interviewLocale: "pt",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty reviewItemIds array", () => {
    const result = createReviewSessionSchema.safeParse({
      reviewItemIds: [],
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Select at least one review item",
      );
    }
  });

  it("rejects more than 10 review item ids", () => {
    const reviewItemIds = Array.from({ length: 11 }, (_, index) =>
      `550e8400-e29b-41d4-a716-44665544${String(index).padStart(4, "0")}`,
    );

    const result = createReviewSessionSchema.safeParse({
      reviewItemIds,
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Select at most 10 review items per session",
      );
    }
  });

  it("rejects duplicate review item ids", () => {
    const result = createReviewSessionSchema.safeParse({
      reviewItemIds: [reviewItemId1, reviewItemId1],
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Duplicate item IDs");
    }
  });

  it("rejects invalid uuid values", () => {
    const result = createReviewSessionSchema.safeParse({
      reviewItemIds: ["not-a-uuid"],
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing interviewLocale", () => {
    const result = createReviewSessionSchema.safeParse({
      reviewItemIds: [reviewItemId1],
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid interviewLocale", () => {
    const result = createReviewSessionSchema.safeParse({
      reviewItemIds: [reviewItemId1],
      interviewLocale: "pt-BR",
    });

    expect(result.success).toBe(false);
  });
});

describe("reviewSessionStreamBodySchema", () => {
  it("accepts interviewLocale without answer for the first stream call", () => {
    const result = reviewSessionStreamBodySchema.safeParse({
      interviewLocale: "en",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ interviewLocale: "en" });
    }
  });

  it.each(["en", "pt"] as const)(
    "accepts interviewLocale %s",
    (interviewLocale) => {
      const result = reviewSessionStreamBodySchema.safeParse({
        interviewLocale,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interviewLocale).toBe(interviewLocale);
      }
    },
  );

  it("accepts a non-empty trimmed answer with interviewLocale", () => {
    const result = reviewSessionStreamBodySchema.safeParse({
      answer: "  I would use a hash map for O(1) lookups.  ",
      interviewLocale: "pt",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        answer: "I would use a hash map for O(1) lookups.",
        interviewLocale: "pt",
      });
    }
  });

  it("rejects empty answer strings", () => {
    const result = reviewSessionStreamBodySchema.safeParse({
      answer: "",
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only answer strings", () => {
    const result = reviewSessionStreamBodySchema.safeParse({
      answer: "   ",
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects answers longer than 4000 characters", () => {
    const result = reviewSessionStreamBodySchema.safeParse({
      answer: "x".repeat(4_001),
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing interviewLocale", () => {
    const result = reviewSessionStreamBodySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects invalid interviewLocale", () => {
    const result = reviewSessionStreamBodySchema.safeParse({
      interviewLocale: "EN",
    });

    expect(result.success).toBe(false);
  });
});

const sessionItemId1 = "550e8400-e29b-41d4-a716-446655440010";
const sessionItemId2 = "550e8400-e29b-41d4-a716-446655440011";

describe("applyReviewSessionSchema", () => {
  it("accepts active items with priority and learned items without priority", () => {
    const result = applyReviewSessionSchema.safeParse({
      items: [
        {
          reviewSessionItemId: sessionItemId1,
          status: "active",
          priority: "high",
        },
        {
          reviewSessionItemId: sessionItemId2,
          status: "learned",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects active items without priority", () => {
    const result = applyReviewSessionSchema.safeParse({
      items: [
        {
          reviewSessionItemId: sessionItemId1,
          status: "active",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Priority is required when status is active",
      );
    }
  });

  it("rejects duplicate reviewSessionItemId values", () => {
    const result = applyReviewSessionSchema.safeParse({
      items: [
        {
          reviewSessionItemId: sessionItemId1,
          status: "active",
          priority: "low",
        },
        {
          reviewSessionItemId: sessionItemId1,
          status: "learned",
        },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Duplicate item IDs");
    }
  });

  it("rejects an empty items array", () => {
    const result = applyReviewSessionSchema.safeParse({ items: [] });

    expect(result.success).toBe(false);
  });
});

describe("reviewSessionEvaluationOutputSchema", () => {
  it("accepts learned status with null priority", () => {
    expect(
      reviewSessionEvaluationOutputSchema.parse({
        status: "learned",
        priority: null,
      }),
    ).toEqual({ status: "learned", priority: null });
  });

  it("accepts active status with priority", () => {
    expect(
      reviewSessionEvaluationOutputSchema.parse({
        status: "active",
        priority: "medium",
      }),
    ).toEqual({ status: "active", priority: "medium" });
  });

  it("rejects active status with null priority", () => {
    expect(() =>
      reviewSessionEvaluationOutputSchema.parse({
        status: "active",
        priority: null,
      }),
    ).toThrow();
  });

  it("rejects learned status with a priority", () => {
    expect(() =>
      reviewSessionEvaluationOutputSchema.parse({
        status: "learned",
        priority: "low",
      }),
    ).toThrow();
  });

  it("rejects invalid priority values", () => {
    expect(() =>
      reviewSessionEvaluationOutputSchema.parse({
        status: "active",
        priority: "urgent",
      }),
    ).toThrow();
  });

  it("rejects unknown status values", () => {
    expect(() =>
      reviewSessionEvaluationOutputSchema.parse({
        status: "pending",
        priority: "low",
      }),
    ).toThrow();
  });
});

describe("listReviewSessionsQuerySchema", () => {
  it("accepts a single status and defaults page/limit", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "completed",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        status: ["completed"],
        page: 1,
        limit: 10,
      });
    }
  });

  it("accepts comma-separated statuses", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "in_progress,pending_review",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["in_progress", "pending_review"]);
    }
  });

  it("trims whitespace around status tokens", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: " completed , in_progress ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["completed", "in_progress"]);
    }
  });

  it("coerces page and limit from query strings", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "completed",
      page: "2",
      limit: "20",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        status: ["completed"],
        page: 2,
        limit: 20,
      });
    }
  });

  it("rejects missing status", () => {
    const result = listReviewSessionsQuerySchema.safeParse({});

    expect(result.success).toBe(false);
  });

  it("rejects empty status string", () => {
    const result = listReviewSessionsQuerySchema.safeParse({ status: "" });

    expect(result.success).toBe(false);
  });

  it("rejects empty status tokens", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "completed,",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid status values", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "cancelled",
    });

    expect(result.success).toBe(false);
  });

  it("rejects page less than 1", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "completed",
      page: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects limit less than 1", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "completed",
      limit: 0,
    });

    expect(result.success).toBe(false);
  });

  it("rejects limit greater than 50", () => {
    const result = listReviewSessionsQuerySchema.safeParse({
      status: "completed",
      limit: 51,
    });

    expect(result.success).toBe(false);
  });
});
