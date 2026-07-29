import { beforeEach, describe, expect, it, vi } from "vitest";

type ChatOpenAIConstructorArgs = Record<string, unknown>;

const chatOpenAIConstructorCalls = vi.hoisted(
  () => [] as ChatOpenAIConstructorArgs[],
);

vi.mock("@langchain/openai", () => ({
  ChatOpenAI: vi.fn((fields: ChatOpenAIConstructorArgs) => {
    chatOpenAIConstructorCalls.push(fields);
    return {
      model: fields.model,
      caller: { maxRetries: fields.maxRetries ?? 6 },
      invoke: vi.fn(),
    };
  }),
}));

import {
  createExtractionModel,
  createInterviewModel,
  createReviewModel,
  isReasoningModel,
} from "./openai-models";

describe("isReasoningModel", () => {
  it.each([
    ["gpt-5", true],
    ["gpt-5-nano", true],
    ["gpt-5-mini", true],
    ["gpt-5-chat-latest", false],
    ["gpt-4o", false],
  ])("returns %s -> %s", (model, expected) => {
    expect(isReasoningModel(model)).toBe(expected);
  });
});

describe("create*Model", () => {
  beforeEach(() => {
    chatOpenAIConstructorCalls.length = 0;
  });

  it("createInterviewModel uses prompt cache retention and no generation overrides", () => {
    createInterviewModel();

    expect(chatOpenAIConstructorCalls).toHaveLength(1);
    const args = chatOpenAIConstructorCalls[0]!;

    expect(args.model).toBe("gpt-5");
    expect(args.promptCacheRetention).toBe("24h");
    expect(args).not.toHaveProperty("reasoning");
    expect(args).not.toHaveProperty("reasoningEffort");
    expect(args).not.toHaveProperty("verbosity");
    expect(args).not.toHaveProperty("maxRetries");
    expect(args).not.toHaveProperty("temperature");
    expect(args).not.toHaveProperty("topP");
  });

  it("createExtractionModel uses provider defaults (no generation overrides)", () => {
    createExtractionModel();

    expect(chatOpenAIConstructorCalls).toHaveLength(1);
    const args = chatOpenAIConstructorCalls[0]!;

    expect(args.model).toBe("gpt-5-nano");
    expect(args).not.toHaveProperty("reasoning");
    expect(args).not.toHaveProperty("reasoningEffort");
    expect(args).not.toHaveProperty("maxRetries");
    expect(args).not.toHaveProperty("temperature");
    expect(args).not.toHaveProperty("topP");
  });

  it("createReviewModel uses provider defaults (no generation overrides)", () => {
    createReviewModel();

    expect(chatOpenAIConstructorCalls).toHaveLength(1);
    const args = chatOpenAIConstructorCalls[0]!;

    expect(args.model).toBe("gpt-5-nano");
    expect(args).not.toHaveProperty("reasoning");
    expect(args).not.toHaveProperty("reasoningEffort");
    expect(args).not.toHaveProperty("verbosity");
    expect(args).not.toHaveProperty("maxRetries");
    expect(args).not.toHaveProperty("temperature");
    expect(args).not.toHaveProperty("topP");
  });
});
