import { ChatOpenAI } from "@langchain/openai";

import { env } from "@/config/env";

/**
 * Heuristic for OpenAI reasoning models (gpt-5 family).
 * Reasoning models reject `temperature`/`top_p` with HTTP 400.
 *
 * @see https://platform.openai.com/docs/guides/reasoning
 */
export function isReasoningModel(model: string): boolean {
  return /^gpt-5/.test(model) && !model.includes("-chat-latest");
}

function createBaseOpenAIModel(model: string): ChatOpenAI {
  return new ChatOpenAI({
    model,
    apiKey: env.OPENAI_API_KEY,
  });
}

export function createInterviewModel(): ChatOpenAI {
  return new ChatOpenAI({
    model: env.OPENAI_MODEL_INTERVIEW,
    apiKey: env.OPENAI_API_KEY,
    // Extended retention for multi-turn sessions that may pause (pre-gpt-5.6 models).
    promptCacheRetention: "24h",
  });
}

export function createExtractionModel(): ChatOpenAI {
  return createBaseOpenAIModel(env.OPENAI_MODEL_EXTRACTION);
}

export function createReviewModel(): ChatOpenAI {
  return createBaseOpenAIModel(env.OPENAI_MODEL_REVIEW);
}
