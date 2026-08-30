import { HumanMessage } from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";
import { describe, expect, it, vi } from "vitest";

import {
  CURRENT_PRIORITY_SECTION_HEADER,
  TOPIC_SECTION_HEADER,
  TURNS_SECTION_HEADER,
} from "@/modules/review-sessions/prompts/review-session-evaluation-prompt";
import type { ReviewSessionEvaluationInput } from "@/modules/review-sessions/protocols/review-session-evaluator";

import {
  createReviewSessionEvaluationNode,
  type StructuredEvaluationModel,
} from "./review-session-evaluation-node";

const baseInput: ReviewSessionEvaluationInput = {
  topic: "Concurrency primitives",
  angle: "mutex vs semaphore trade-offs",
  description: "Needs practice explaining mutex vs semaphore trade-offs.",
  currentPriority: "medium",
  turns: [
    {
      question: "When would you pick a mutex over a semaphore?",
      answer: "When only one thread should access a shared resource.",
    },
    {
      question: "What can go wrong without synchronization?",
      answer: "Race conditions and data corruption.",
    },
  ],
  interviewLocale: "en",
};

function humanMessageContentFromInvokeArg(input: unknown): string {
  if (
    typeof input === "object" &&
    input !== null &&
    "toChatMessages" in input &&
    typeof input.toChatMessages === "function"
  ) {
    const messages = input.toChatMessages() as HumanMessage[];
    return String(messages[0]?.content ?? "");
  }

  if (Array.isArray(input)) {
    return String((input[0] as HumanMessage | undefined)?.content ?? "");
  }

  return "";
}

describe("createReviewSessionEvaluationNode", () => {
  it("invokes structuredModel via ChatPromptTemplate with scoped item prompt content", async () => {
    const evaluated = {
      status: "learned" as const,
      priority: null,
      wentWell: [],
      workOn: [],
    };
    const invoke = vi.fn().mockResolvedValue(evaluated);
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    const result = await node(baseInput);

    expect(invoke).toHaveBeenCalledOnce();
    const content = humanMessageContentFromInvokeArg(invoke.mock.calls[0]?.[0]);
    expect(content).toContain(TOPIC_SECTION_HEADER);
    expect(content).toContain(baseInput.topic);
    expect(content).toContain(baseInput.description);
    expect(content).toContain(CURRENT_PRIORITY_SECTION_HEADER);
    expect(content).toContain("medium");
    expect(content).toContain(TURNS_SECTION_HEADER);
    expect(content).toContain(baseInput.turns[0]!.question);
    expect(content).toContain(baseInput.turns[1]!.answer);
    expect(content).not.toContain("Unrelated topic from another item");
    expect(result).toEqual(evaluated);
  });

  it("returns active suggestions with priority after schema.parse re-validation", async () => {
    const evaluated = {
      status: "active" as const,
      priority: "low" as const,
      wentWell: [],
      workOn: [],
    };
    const invoke = vi.fn().mockResolvedValue(evaluated);
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    const result = await node(baseInput);

    expect(result).toEqual(evaluated);
  });

  it("rejects malformed structuredModel output via schema.parse", async () => {
    const invoke = vi.fn().mockResolvedValue({ status: "active", priority: null });
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    await expect(node(baseInput)).rejects.toThrow();
  });

  it("propagates structuredModel.invoke errors with the original message", async () => {
    const failure = new Error("OpenAI request failed after retries");
    const invoke = vi.fn().mockRejectedValue(failure);
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    await expect(node(baseInput)).rejects.toBe(failure);
    expect(failure.message).toBe("OpenAI request failed after retries");
  });

  it("defaults missing recap keys to empty arrays", async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: "learned",
      priority: null,
    });
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    const result = await node(baseInput);

    expect(result).toEqual({
      status: "learned",
      priority: null,
      wentWell: [],
      workOn: [],
    });
  });

  it("clamps over-cap recap bullets instead of throwing", async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: "learned",
      priority: null,
      wentWell: ["one", "two", "three", "four", "five"],
      workOn: ["a", "b", "c", "d", "e"],
    });
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    await expect(node(baseInput)).resolves.toEqual({
      status: "learned",
      priority: null,
      wentWell: ["one", "two", "three", "four"],
      workOn: ["a", "b", "c", "d"],
    });
  });

  it("truncates recap bullets longer than 180 characters instead of throwing", async () => {
    const longBullet = "x".repeat(181);
    const invoke = vi.fn().mockResolvedValue({
      status: "active",
      priority: "medium",
      wentWell: [longBullet],
      workOn: [longBullet],
    });
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    await expect(node(baseInput)).resolves.toEqual({
      status: "active",
      priority: "medium",
      wentWell: ["x".repeat(180)],
      workOn: ["x".repeat(180)],
    });
  });

  it("drops blank recap bullets after trim", async () => {
    const invoke = vi.fn().mockResolvedValue({
      status: "learned",
      priority: null,
      wentWell: ["kept", "   ", "", "also kept"],
      workOn: ["  "],
    });
    const node = createReviewSessionEvaluationNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredEvaluationModel,
    });

    await expect(node(baseInput)).resolves.toEqual({
      status: "learned",
      priority: null,
      wentWell: ["kept", "also kept"],
      workOn: [],
    });
  });
});
