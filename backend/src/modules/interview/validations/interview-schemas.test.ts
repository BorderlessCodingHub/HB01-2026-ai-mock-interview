import { describe, expect, it } from "vitest";

import {
  createSessionSchema,
  listSessionsQuerySchema,
  reviewItemsGeneratorOutputSchema,
  streamMessageSchema,
  submitFeedbackSchema,
  topicCoverageGeneratorOutputSchema,
  weakAnswersGeneratorOutputSchema,
} from "./interview-schemas";

const validResumeId = "550e8400-e29b-41d4-a716-446655440000";

describe("createSessionSchema", () => {
  it("accepts a valid resumeId, level, interviewLocale, and turns", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "mid",
      interviewLocale: "en",
      turns: 8,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        resumeId: validResumeId,
        level: "mid",
        interviewLocale: "en",
        turns: 8,
      });
    }
  });

  it.each(["entry", "mid", "senior"] as const)("accepts level %s", (level) => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level,
      interviewLocale: "en",
      turns: 8,
    });

    expect(result.success).toBe(true);
  });

  it.each(["en", "pt"] as const)(
    "accepts interviewLocale %s",
    (interviewLocale) => {
      const result = createSessionSchema.safeParse({
        resumeId: validResumeId,
        level: "mid",
        interviewLocale,
        turns: 8,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interviewLocale).toBe(interviewLocale);
      }
    },
  );

  it("rejects invalid resumeId", () => {
    const result = createSessionSchema.safeParse({
      resumeId: "not-a-uuid",
      level: "entry",
      interviewLocale: "en",
      turns: 8,
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid level", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "staff",
      interviewLocale: "en",
      turns: 8,
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(
      createSessionSchema.safeParse({
        resumeId: validResumeId,
        interviewLocale: "en",
        turns: 8,
      }).success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        level: "entry",
        interviewLocale: "en",
        turns: 8,
      }).success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        resumeId: validResumeId,
        level: "entry",
        turns: 8,
      }).success,
    ).toBe(false);
    expect(
      createSessionSchema.safeParse({
        resumeId: validResumeId,
        level: "entry",
        interviewLocale: "en",
      }).success,
    ).toBe(false);
  });

  it("rejects invalid interviewLocale", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "mid",
      interviewLocale: "pt-BR",
      turns: 8,
    });

    expect(result.success).toBe(false);
  });

  it("accepts an optional job description", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "mid",
      interviewLocale: "pt",
      turns: 8,
      jobDescription: "Senior Backend Engineer",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobDescription).toBe("Senior Backend Engineer");
    }
  });

  it("rejects job description over 5000 characters", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "mid",
      interviewLocale: "en",
      turns: 8,
      jobDescription: "x".repeat(5_001),
    });

    expect(result.success).toBe(false);
  });

  it.each(["entry", "mid", "senior"] as const)(
    "accepts turns at the flat maximum (20) regardless of level %s",
    (level) => {
      const result = createSessionSchema.safeParse({
        resumeId: validResumeId,
        level,
        interviewLocale: "en",
        turns: 20,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.turns).toBe(20);
      }
    },
  );

  it("rejects turns above the flat maximum", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "senior",
      interviewLocale: "en",
      turns: 21,
    });

    expect(result.success).toBe(false);
  });

  it("rejects turns below the minimum", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "senior",
      interviewLocale: "en",
      turns: 2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a missing turns value", () => {
    const result = createSessionSchema.safeParse({
      resumeId: validResumeId,
      level: "mid",
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });
});

describe("streamMessageSchema", () => {
  it("accepts non-empty content with interviewLocale", () => {
    const result = streamMessageSchema.safeParse({
      content: "I would use a hash map for O(1) lookups.",
      interviewLocale: "en",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        content: "I would use a hash map for O(1) lookups.",
        interviewLocale: "en",
      });
    }
  });

  it.each(["en", "pt"] as const)(
    "accepts interviewLocale %s",
    (interviewLocale) => {
      const result = streamMessageSchema.safeParse({
        content: "Hello interviewer",
        interviewLocale,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.interviewLocale).toBe(interviewLocale);
      }
    },
  );

  it("trims surrounding whitespace from content", () => {
    const result = streamMessageSchema.safeParse({
      content: "  Hello interviewer  ",
      interviewLocale: "pt",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.content).toBe("Hello interviewer");
    }
  });

  it("rejects empty content", () => {
    const result = streamMessageSchema.safeParse({
      content: "",
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only content", () => {
    const result = streamMessageSchema.safeParse({
      content: "   ",
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects content over 10000 characters", () => {
    const result = streamMessageSchema.safeParse({
      content: "x".repeat(10_001),
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Message content is too long",
      );
    }
  });

  it("rejects missing content", () => {
    const result = streamMessageSchema.safeParse({
      interviewLocale: "en",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing interviewLocale", () => {
    const result = streamMessageSchema.safeParse({
      content: "Hello interviewer",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid interviewLocale", () => {
    const result = streamMessageSchema.safeParse({
      content: "Hello interviewer",
      interviewLocale: "EN",
    });

    expect(result.success).toBe(false);
  });
});

describe("reviewItemsGeneratorOutputSchema", () => {
  const validOutput = {
    items: [
      {
        topic: "System design trade-offs",
        angle: "caching strategy comparison",
        description: "Candidate struggled to compare caching strategies.",
        priority: "high" as const,
      },
      {
        topic: "Concurrency",
        angle: "race condition explanation",
        description: "Needs practice explaining race conditions.",
        priority: "medium" as const,
      },
    ],
  };

  it("accepts a valid items array", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse(validOutput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validOutput);
    }
  });

  it("accepts an empty items array", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse({ items: [] });

    expect(result.success).toBe(true);
  });

  it("rejects invalid priority", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse({
      items: [
        {
          topic: "Testing",
          angle: "unit test coverage",
          description: "Improve unit test coverage.",
          priority: "critical",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects item with empty topic", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse({
      items: [
        {
          topic: "  ",
          angle: "edge cases",
          description: "Needs improvement.",
          priority: "low",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects item with empty angle", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse({
      items: [
        {
          topic: "Testing",
          angle: "  ",
          description: "Needs improvement.",
          priority: "low",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing angle", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse({
      items: [
        {
          topic: "Testing",
          description: "Needs improvement.",
          priority: "low",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing items field", () => {
    const result = reviewItemsGeneratorOutputSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("weakAnswersGeneratorOutputSchema", () => {
  const validOutput = {
    items: [
      {
        question: "How would you scale a read-heavy API?",
        userAnswer: "I'd just add more servers.",
        evaluation: "insufficient" as const,
        feedback: "Mention caching, read replicas, and CDN strategies.",
        topic: "System design",
        priority: "high" as const,
      },
    ],
  };

  it("accepts a valid items array", () => {
    const result = weakAnswersGeneratorOutputSchema.safeParse(validOutput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validOutput);
    }
  });

  it("accepts an empty items array", () => {
    const result = weakAnswersGeneratorOutputSchema.safeParse({ items: [] });

    expect(result.success).toBe(true);
  });

  it.each(["incorrect", "incomplete", "insufficient", "satisfactory"] as const)(
    "accepts evaluation %s",
    (evaluation) => {
      const result = weakAnswersGeneratorOutputSchema.safeParse({
        items: [{ ...validOutput.items[0], evaluation }],
      });

      expect(result.success).toBe(true);
    },
  );

  it("rejects invalid evaluation", () => {
    const result = weakAnswersGeneratorOutputSchema.safeParse({
      items: [{ ...validOutput.items[0], evaluation: "wrong" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects item with empty question", () => {
    const result = weakAnswersGeneratorOutputSchema.safeParse({
      items: [{ ...validOutput.items[0], question: "  " }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects item with empty feedback", () => {
    const result = weakAnswersGeneratorOutputSchema.safeParse({
      items: [{ ...validOutput.items[0], feedback: "" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing items field", () => {
    const result = weakAnswersGeneratorOutputSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("topicCoverageGeneratorOutputSchema", () => {
  const validOutput = {
    items: [
      {
        topic: "System design trade-offs",
        angle: "Compare caching strategies for read-heavy APIs.",
      },
      {
        topic: "Concurrency",
        angle: "Explain race conditions and mitigation patterns.",
      },
    ],
  };

  it("accepts a valid items array", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse(validOutput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validOutput);
    }
  });

  it("accepts an empty items array", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({ items: [] });

    expect(result.success).toBe(true);
  });

  it("rejects more than 8 items", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({
      items: Array.from({ length: 9 }, (_, index) => ({
        topic: `Topic ${index + 1}`,
        angle: `Angle ${index + 1}`,
      })),
    });

    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace from topic and angle", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({
      items: [
        {
          topic: "  Distributed systems  ",
          angle: "  CAP theorem trade-offs  ",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]).toEqual({
        topic: "Distributed systems",
        angle: "CAP theorem trade-offs",
      });
    }
  });

  it("rejects item with empty topic", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({
      items: [{ topic: "  ", angle: "Valid angle." }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects item with empty angle", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({
      items: [{ topic: "Valid topic", angle: "  " }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects topic over 120 characters", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({
      items: [{ topic: "x".repeat(121), angle: "Valid angle." }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects angle over 200 characters", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({
      items: [{ topic: "Valid topic", angle: "x".repeat(201) }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing items field", () => {
    const result = topicCoverageGeneratorOutputSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});

describe("submitFeedbackSchema", () => {
  it("accepts valid rating with optional comment", () => {
    const result = submitFeedbackSchema.safeParse({
      rating: "up",
      comment: "Great interview experience.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        rating: "up",
        comment: "Great interview experience.",
      });
    }
  });

  it("accepts rating without comment", () => {
    const result = submitFeedbackSchema.safeParse({ rating: "down" });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ rating: "down" });
    }
  });

  it("rejects missing rating", () => {
    const result = submitFeedbackSchema.safeParse({
      comment: "No rating provided.",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid rating value", () => {
    const result = submitFeedbackSchema.safeParse({
      rating: "neutral",
      comment: "Not sure.",
    });

    expect(result.success).toBe(false);
  });

  it("rejects comment over the length limit", () => {
    const result = submitFeedbackSchema.safeParse({
      rating: "up",
      comment: "a".repeat(1001),
    });

    expect(result.success).toBe(false);
  });
});

describe("listSessionsQuerySchema", () => {
  it("defaults page and limit when omitted", () => {
    const result = listSessionsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 1, limit: 50 });
    }
  });

  it("coerces page and limit from query string values", () => {
    const result = listSessionsQuerySchema.safeParse({
      page: "2",
      limit: "25",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ page: 2, limit: 25 });
    }
  });

  it("rejects a page below 1", () => {
    const result = listSessionsQuerySchema.safeParse({ page: "0" });

    expect(result.success).toBe(false);
  });

  it("rejects a limit above 50", () => {
    const result = listSessionsQuerySchema.safeParse({ limit: "51" });

    expect(result.success).toBe(false);
  });
});
