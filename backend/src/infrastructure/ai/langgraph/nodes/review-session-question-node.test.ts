import { HumanMessage } from "@langchain/core/messages";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { ChatOpenAI } from "@langchain/openai";
import { describe, expect, it, vi } from "vitest";

import {
  DESCRIPTION_SECTION_HEADER,
  PERSONA_SECTION_HEADER,
  PRIOR_TURNS_SECTION_HEADER,
  TOPIC_SECTION_HEADER,
} from "@/modules/review-sessions/prompts/review-session-question-prompt";

import { createReviewSessionQuestionNode } from "./review-session-question-node";

function humanMessageContentFromStreamArg(input: unknown): string {
  if (!Array.isArray(input)) {
    return "";
  }

  const message = input[0];
  if (message instanceof HumanMessage) {
    return String(message.content);
  }

  return String((message as HumanMessage | undefined)?.content ?? "");
}

describe("createReviewSessionQuestionNode", () => {
  it("streams token chunks and returns final content with usage", async () => {
    const stream = vi.fn().mockImplementation(async function* () {
      yield { content: "What " };
      yield {
        content: "is eventual consistency?",
        usage_metadata: { input_tokens: 42, output_tokens: 7 },
      };
    });

    const model = { stream } as unknown as ChatOpenAI;
    const generator = createReviewSessionQuestionNode({ model });

    const iterator = generator.streamQuestion({
      topic: "Distributed systems",
      angle: "consistency trade-offs",
      description: "Explain consistency trade-offs.",
      turns: [],
      interviewLocale: "en",
    });

    const tokens: string[] = [];
    let result = await iterator.next();

    while (!result.done) {
      tokens.push(result.value.content);
      result = await iterator.next();
    }

    expect(tokens).toEqual(["What ", "is eventual consistency?"]);
    expect(result.value).toEqual({
      content: "What is eventual consistency?",
      usage: { promptTokens: 42, completionTokens: 7 },
    });
  });

  it("scopes prompt inputs to the single item (topic, description, and its own turns only)", async () => {
    const stream = vi.fn().mockImplementation(async function* () {
      yield { content: "Follow-up question?" };
    });
    const model = { stream } as unknown as ChatOpenAI;
    const generator = createReviewSessionQuestionNode({ model });

    const turns = [
      {
        question: "How would you scale reads?",
        answer: "Add replicas and cache hot keys.",
      },
    ];

    const iterator = generator.streamQuestion({
      topic: "System design trade-offs",
      angle: "CAP theorem implications",
      description: "Practice articulating CAP theorem implications.",
      turns,
      interviewLocale: "en",
    });

    let result = await iterator.next();
    while (!result.done) {
      result = await iterator.next();
    }

    expect(stream).toHaveBeenCalledOnce();
    const prompt = humanMessageContentFromStreamArg(stream.mock.calls[0]?.[0]);
    expect(prompt).toContain(PERSONA_SECTION_HEADER);
    expect(prompt).toContain(TOPIC_SECTION_HEADER);
    expect(prompt).toContain("System design trade-offs");
    expect(prompt).toContain(DESCRIPTION_SECTION_HEADER);
    expect(prompt).toContain("Practice articulating CAP theorem implications.");
    expect(prompt).toContain(PRIOR_TURNS_SECTION_HEADER);
    expect(prompt).toContain("Q1: How would you scale reads?");
    expect(prompt).toContain("A1: Add replicas and cache hot keys.");
    expect(prompt).not.toContain("Other item topic");
  });

  it("omits prior turns section for the first question", async () => {
    const stream = vi.fn().mockImplementation(async function* () {
      yield { content: "First question?" };
    });
    const model = { stream } as unknown as ChatOpenAI;
    const generator = createReviewSessionQuestionNode({ model });

    const iterator = generator.streamQuestion({
      topic: "API design",
      angle: "REST resource modeling",
      description: "Validate REST resource modeling.",
      turns: [],
      interviewLocale: "en",
    });

    let result = await iterator.next();
    while (!result.done) {
      result = await iterator.next();
    }

    const prompt = humanMessageContentFromStreamArg(stream.mock.calls[0]?.[0]);
    expect(prompt).not.toContain(PRIOR_TURNS_SECTION_HEADER);
  });

  it("forwards callbacks to ChatOpenAI.stream", async () => {
    const stream = vi.fn().mockImplementation(async function* () {
      yield { content: "Question?" };
    });
    const model = { stream } as unknown as ChatOpenAI;
    const generator = createReviewSessionQuestionNode({ model });
    const callbacks = [
      BaseCallbackHandler.fromMethods({ handleLLMEnd: () => undefined }),
    ];

    const iterator = generator.streamQuestion(
      {
        topic: "Testing",
        angle: "mocking dependencies",
        description: "Mock dependencies.",
        turns: [],
        interviewLocale: "pt",
      },
      { callbacks },
    );

    let result = await iterator.next();
    while (!result.done) {
      result = await iterator.next();
    }

    expect(stream).toHaveBeenCalledWith(expect.any(Array), { callbacks });
  });
});
