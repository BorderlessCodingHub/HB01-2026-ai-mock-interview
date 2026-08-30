import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { ChatOpenAI } from "@langchain/openai";

import { createReviewModel } from "@/infrastructure/ai/openai-models";
import { buildReviewSessionEvaluationPrompt } from "@/modules/review-sessions/prompts/review-session-evaluation-prompt";
import type { ReviewSessionEvaluationInput } from "@/modules/review-sessions/protocols/review-session-evaluator";
import {
  normalizeReviewSessionEvaluation,
  reviewSessionEvaluationOutputSchema,
  type ReviewSessionEvaluationOutput,
} from "@/modules/review-sessions/validations/review-session-schemas";

export type StructuredEvaluationModel = {
  invoke: (input: unknown) => Promise<unknown>;
};

export type ReviewSessionEvaluationNodeDeps = {
  model?: ChatOpenAI;
  structuredModel?: StructuredEvaluationModel;
};

export function createReviewSessionEvaluationNode(
  deps: ReviewSessionEvaluationNodeDeps = {},
) {
  const structuredModel =
    deps.structuredModel ??
    (deps.model ?? createReviewModel()).withStructuredOutput(
      reviewSessionEvaluationOutputSchema,
    );

  return async function reviewSessionEvaluationNode(
    input: ReviewSessionEvaluationInput,
    config?: RunnableConfig,
  ): Promise<ReviewSessionEvaluationOutput> {
    const promptText = buildReviewSessionEvaluationPrompt(input);

    // Pass prompt as a template variable so JSON braces in turns are not
    // parsed as LangChain input placeholders (INVALID_PROMPT_INPUT).
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["human", "{prompt}"],
    ]);
    const chain = promptTemplate.pipe(structuredModel);
    const invokeInput = { prompt: promptText };
    const raw = config
      ? await chain.invoke(invokeInput, config)
      : await chain.invoke(invokeInput);
    return normalizeReviewSessionEvaluation(
      reviewSessionEvaluationOutputSchema.parse(raw),
    );
  };
}
