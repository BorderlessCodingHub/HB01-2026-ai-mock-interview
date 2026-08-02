import { HumanMessage } from "@langchain/core/messages";
import { RunnableLambda } from "@langchain/core/runnables";
import { describe, expect, it, vi } from "vitest";

import {
  PERSONA_SECTION_HEADER,
  TRANSCRIPT_SECTION_HEADER,
} from "@/modules/interview/prompts/review-items-generator-prompt";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";

import {
  createReviewItemsGeneratorNode,
  type ReviewItemsGeneratorInput,
  type StructuredReviewModel,
} from "./review-items-generator-node";

const structuredSummary: StructuredSummary = {
  personal_info: { name: "Jane", title: "Engineer", about: "" },
  skills: ["TypeScript"],
  experiences: [],
  projects: [],
  certifications: [],
};

const baseInput: ReviewItemsGeneratorInput = {
  transcript: "Q: Tell me about yourself.\nA: I build APIs.",
  existingItems: [],
  structuredSummary,
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

describe("createReviewItemsGeneratorNode", () => {
  it("invokes structuredModel via ChatPromptTemplate with rendered prompt content", async () => {
    const generated = {
      items: [
        {
          topic: "System design",
          angle: "caching trade-offs",
          description: "Practice trade-offs",
          priority: "high" as const,
        },
      ],
    };
    const invoke = vi.fn().mockResolvedValue(generated);
    const node = createReviewItemsGeneratorNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredReviewModel,
    });

    const result = await node(baseInput);

    expect(invoke).toHaveBeenCalledOnce();
    const content = humanMessageContentFromInvokeArg(invoke.mock.calls[0]?.[0]);
    expect(content).toContain(TRANSCRIPT_SECTION_HEADER);
    expect(content).toContain(baseInput.transcript);
    expect(content).toContain(PERSONA_SECTION_HEADER);
    expect(content).toContain("Tech Lead reviewing an interview");
    expect(result).toEqual(generated);
  });

  it("renders existing review items JSON without LangChain template variable errors", async () => {
    const existingItems = [
      {
        topic: "interview problem-solving and hypothesis-driven answering",
        angle: "structured hypothesis framing",
        description:
          "Candidate was honest about not knowing (positive) but did not attempt a high-level hypothesis.",
        priority: "medium" as const,
      },
    ];
    const invoke = vi.fn().mockResolvedValue({ items: [] });
    const node = createReviewItemsGeneratorNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredReviewModel,
    });

    await node({ ...baseInput, existingItems });

    const content = humanMessageContentFromInvokeArg(invoke.mock.calls[0]?.[0]);
    expect(content).toContain(existingItems[0]!.topic);
    expect(content).toContain('"priority": "medium"');
  });

  it("propagates rejected structuredModel.invoke errors with the original message", async () => {
    const failure = new Error("OpenAI request failed after retries");
    const invoke = vi.fn().mockRejectedValue(failure);
    const node = createReviewItemsGeneratorNode({
      structuredModel: RunnableLambda.from(
        invoke,
      ) as unknown as StructuredReviewModel,
    });

    await expect(node(baseInput)).rejects.toBe(failure);
    expect(failure.message).toBe("OpenAI request failed after retries");
  });
});
