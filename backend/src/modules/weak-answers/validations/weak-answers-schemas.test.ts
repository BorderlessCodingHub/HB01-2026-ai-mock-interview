import { describe, expect, it } from "vitest";

import {
  listWeakAnswersResponseSchema,
  weakAnswerResponseSchema,
} from "./weak-answers-schemas";

const validWeakAnswerId = "550e8400-e29b-41d4-a716-446655440000";
const validSessionId = "660e8400-e29b-41d4-a716-446655440001";

const validWeakAnswer = {
  id: validWeakAnswerId,
  sessionId: validSessionId,
  question: "How would you scale a read-heavy API?",
  userAnswer: "I'd just add more servers.",
  evaluation: "insufficient" as const,
  feedback: "Mention caching, read replicas, and CDN strategies.",
  topic: "System design",
  priority: "high" as const,
  createdAt: "2026-05-30T12:00:00.000Z",
};

describe("weakAnswerResponseSchema", () => {
  it("accepts a valid weak answer", () => {
    const result = weakAnswerResponseSchema.safeParse(validWeakAnswer);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validWeakAnswer);
    }
  });

  it.each(["incorrect", "incomplete", "insufficient", "satisfactory"] as const)(
    "accepts evaluation %s",
    (evaluation) => {
      const result = weakAnswerResponseSchema.safeParse({
        ...validWeakAnswer,
        evaluation,
      });

      expect(result.success).toBe(true);
    },
  );

  it.each(["low", "medium", "high"] as const)(
    "accepts priority %s",
    (priority) => {
      const result = weakAnswerResponseSchema.safeParse({
        ...validWeakAnswer,
        priority,
      });

      expect(result.success).toBe(true);
    },
  );

  it("rejects invalid id", () => {
    const result = weakAnswerResponseSchema.safeParse({
      ...validWeakAnswer,
      id: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a null sessionId after the source interview is deleted", () => {
    const result = weakAnswerResponseSchema.safeParse({
      ...validWeakAnswer,
      sessionId: null,
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid evaluation", () => {
    const result = weakAnswerResponseSchema.safeParse({
      ...validWeakAnswer,
      evaluation: "wrong",
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid createdAt datetime", () => {
    const result = weakAnswerResponseSchema.safeParse({
      ...validWeakAnswer,
      createdAt: "not-a-datetime",
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const { question: _question, ...withoutQuestion } = validWeakAnswer;
    const result = weakAnswerResponseSchema.safeParse(withoutQuestion);

    expect(result.success).toBe(false);
  });
});

describe("listWeakAnswersResponseSchema", () => {
  it("accepts a valid list of weak answers", () => {
    const result = listWeakAnswersResponseSchema.safeParse({
      weakAnswers: [validWeakAnswer],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.weakAnswers).toHaveLength(1);
      expect(result.data.weakAnswers[0]).toEqual(validWeakAnswer);
    }
  });

  it("accepts an empty weakAnswers array", () => {
    const result = listWeakAnswersResponseSchema.safeParse({
      weakAnswers: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid item inside weakAnswers", () => {
    const result = listWeakAnswersResponseSchema.safeParse({
      weakAnswers: [{ ...validWeakAnswer, priority: "urgent" }],
    });

    expect(result.success).toBe(false);
  });

  it("rejects missing weakAnswers field", () => {
    const result = listWeakAnswersResponseSchema.safeParse({});

    expect(result.success).toBe(false);
  });
});
