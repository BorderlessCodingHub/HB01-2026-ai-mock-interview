import { HumanMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import { createReviewModel } from "@/infrastructure/ai/openai-models";
import type {
  IReviewSessionQuestionGenerator,
  ReviewSessionQuestionGeneratorInput,
  ReviewSessionQuestionGeneratorOptions,
  ReviewSessionQuestionStreamResult,
  ReviewSessionQuestionStreamToken,
} from "@/modules/review-sessions/protocols/review-session-question-generator";
import { buildReviewSessionQuestionPrompt } from "@/modules/review-sessions/prompts/review-session-question-prompt";
import { extractLlmUsageFromMetadata } from "@/modules/token-usage/utils/extract-llm-usage";

export type ReviewSessionQuestionNodeDeps = {
  model?: ChatOpenAI;
};

function extractChunkContent(chunk: { content?: unknown }): string {
  if (typeof chunk.content === "string") {
    return chunk.content;
  }

  if (Array.isArray(chunk.content)) {
    return chunk.content
      .map((block) => {
        if (typeof block === "string") {
          return block;
        }

        if (
          block &&
          typeof block === "object" &&
          "text" in block &&
          typeof block.text === "string"
        ) {
          return block.text;
        }

        return "";
      })
      .join("");
  }

  return "";
}

export function createReviewSessionQuestionNode(
  deps: ReviewSessionQuestionNodeDeps = {},
): IReviewSessionQuestionGenerator {
  const model = deps.model ?? createReviewModel();

  return {
    async *streamQuestion(
      input: ReviewSessionQuestionGeneratorInput,
      options?: ReviewSessionQuestionGeneratorOptions,
    ): AsyncGenerator<
      ReviewSessionQuestionStreamToken,
      ReviewSessionQuestionStreamResult
    > {
      const promptText = buildReviewSessionQuestionPrompt({
        topic: input.topic,
        angle: input.angle,
        description: input.description,
        turns: input.turns,
        interviewLocale: input.interviewLocale,
      });

      const stream = await model.stream([new HumanMessage(promptText)], {
        callbacks: options?.callbacks,
      });

      let fullContent = "";
      let usage: ReviewSessionQuestionStreamResult["usage"];

      for await (const chunk of stream) {
        const content = extractChunkContent(chunk);
        if (content) {
          fullContent += content;
          yield { content };
        }

        const chunkUsage = extractLlmUsageFromMetadata(chunk);
        if (chunkUsage) {
          usage = chunkUsage;
        }
      }

      return { content: fullContent, usage };
    },
  };
}
