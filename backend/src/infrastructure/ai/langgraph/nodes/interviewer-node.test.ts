import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { ChatPromptValue } from "@langchain/core/prompt_values";
import { RunnableLambda } from "@langchain/core/runnables";
import type { ChatOpenAI } from "@langchain/openai";
import { describe, expect, it, vi } from "vitest";

import {
  buildClosingFeedbackPrompt,
  CLOSING_EVALUATE_HEADER,
  CLOSING_FEEDBACK_CTA,
  CLOSING_FORMAT_HEADER,
} from "@/modules/interview/prompts/closing-feedback-prompt";
import {
  buildInterviewContextPrompt,
  buildInterviewerSystemPrompt,
  CONDUCT_SECTION_HEADER,
  FORMAT_SECTION_HEADER,
  INTERVIEW_CONTEXT_SECTION_HEADER,
} from "@/modules/interview/prompts/interviewer-system-prompt";

import { createInitialInterviewState } from "../interview-state";
import { createInterviewerNode } from "./interviewer-node";

const sampleResumeSummary = {
  personal_info: { name: "Heno", title: "Engineer", about: "" },
  skills: ["TypeScript"],
  experiences: [{ company: "Acme", role: "Dev", highlights: ["APIs"] }],
  projects: [],
  certifications: [],
};

function createMockModel(content = "Model output") {
  const invoke = vi.fn(
    async (_input: unknown, _config?: unknown) => new AIMessage({ content }),
  );
  const model = RunnableLambda.from(invoke) as unknown as ChatOpenAI;
  return {
    invoke,
    model,
  };
}

function getChainInputMessages(input: unknown): BaseMessage[] {
  if (
    input &&
    typeof input === "object" &&
    "toChatMessages" in input &&
    typeof input.toChatMessages === "function"
  ) {
    return (input as ChatPromptValue).toChatMessages();
  }

  return input as BaseMessage[];
}

function getRenderedSystemContent(messages: BaseMessage[]): string {
  const firstMessage = messages[0];
  return typeof firstMessage?.content === "string" ? firstMessage.content : "";
}

describe("createInterviewerNode", () => {
  const baseState = createInitialInterviewState({
    turnCount: 2,
    maxTurns: 7,
    level: "mid",
    userId: 1,
    resumeSummary: sampleResumeSummary,
    interviewLocale: "en",
  });

  it("invokes with static system + trailing interview context when runReview is false", async () => {
    const { invoke, model } = createMockModel("Next question?");
    const node = createInterviewerNode({ model });
    const state = { ...baseState, runReview: false };

    await node(state);

    const expectedSystemPrompt = buildInterviewerSystemPrompt({
      level: state.level,
      resumeSummary: state.resumeSummary,
      interviewLocale: state.interviewLocale,
    });
    const expectedContext = buildInterviewContextPrompt(
      state.turnCount,
      state.maxTurns,
    );
    const messages = getChainInputMessages(invoke.mock.calls[0]?.[0]);
    const systemContent = getRenderedSystemContent(messages);
    const lastContent = messages.at(-1)?.content;

    expect(systemContent).toBe(expectedSystemPrompt);
    expect(systemContent).toContain(CONDUCT_SECTION_HEADER);
    expect(systemContent).toContain(FORMAT_SECTION_HEADER);
    expect(systemContent).not.toContain(INTERVIEW_CONTEXT_SECTION_HEADER);
    expect(systemContent).not.toContain(CLOSING_EVALUATE_HEADER);
    expect(lastContent).toBe(expectedContext);
  });

  it("passes promptCacheKey from thread_id when runReview is false", async () => {
    const { invoke, model } = createMockModel("Next question?");
    const node = createInterviewerNode({ model });
    const sessionId = "session-cache-key-1";

    await node(
      { ...baseState, runReview: false },
      { configurable: { thread_id: sessionId } },
    );

    const invokeConfig = invoke.mock.calls[0]?.[1] as
      | { promptCacheKey?: string }
      | undefined;
    expect(invokeConfig?.promptCacheKey).toBe(`interview:${sessionId}`);
  });

  it("does not pass promptCacheKey when runReview is true", async () => {
    const { invoke, model } = createMockModel("## What you did well\n\n- Good");
    const node = createInterviewerNode({ model });

    await node(
      { ...baseState, runReview: true },
      { configurable: { thread_id: "session-closing" } },
    );

    const invokeConfig = invoke.mock.calls[0]?.[1] as
      | { promptCacheKey?: string }
      | undefined;
    expect(invokeConfig?.promptCacheKey).toBeUndefined();
  });

  it("invokes with closing feedback prompt when runReview is true", async () => {
    const { invoke, model } = createMockModel(
      "## What you did well\n\n- Good depth",
    );
    const node = createInterviewerNode({ model });
    const state = { ...baseState, runReview: true };

    await node(state);

    const expectedSystemPrompt = buildClosingFeedbackPrompt({
      level: state.level,
      resumeSummary: state.resumeSummary,
      interviewLocale: state.interviewLocale,
    });
    const systemContent = getRenderedSystemContent(
      getChainInputMessages(invoke.mock.calls[0]?.[0]),
    );

    expect(systemContent).toBe(expectedSystemPrompt);
    expect(systemContent).toContain(CLOSING_EVALUATE_HEADER);
    expect(systemContent).toContain(CLOSING_FORMAT_HEADER);
    expect(systemContent).not.toContain(CONDUCT_SECTION_HEADER);
  });

  it("appends closing CTA to AI message when runReview is true", async () => {
    const { model } = createMockModel("Session feedback body");
    const node = createInterviewerNode({ model });

    const result = await node({
      ...baseState,
      runReview: true,
      interviewLocale: "pt",
    });

    expect(result.messages[0]?.content).toContain("Session feedback body");
    expect(result.messages[0]?.content).toContain(CLOSING_FEEDBACK_CTA);
  });

  it("does not append closing CTA when runReview is false", async () => {
    const { model } = createMockModel("What trade-offs did you consider?");
    const node = createInterviewerNode({ model });

    const result = await node({ ...baseState, runReview: false });

    expect(result.messages[0]?.content).toBe(
      "What trade-offs did you consider?",
    );
    expect(result.messages[0]?.content).not.toContain(CLOSING_FEEDBACK_CTA);
  });

  it("propagates rejected model.invoke errors with the original message", async () => {
    const failure = new Error("OpenAI request failed after retries");
    const invoke = vi.fn(async (_input: unknown, _config?: unknown) => {
      throw failure;
    });
    const model = RunnableLambda.from(invoke) as unknown as ChatOpenAI;
    const node = createInterviewerNode({ model });

    await expect(node({ ...baseState, runReview: false })).rejects.toBe(
      failure,
    );
    expect(failure.message).toBe("OpenAI request failed after retries");
  });
});
