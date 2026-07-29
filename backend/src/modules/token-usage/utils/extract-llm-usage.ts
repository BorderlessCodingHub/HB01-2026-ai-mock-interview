import type { LlmUsage } from "@/modules/token-usage/types/llm-usage";

type UsageMetadata = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  input_token_details?: {
    cache_read?: number;
    cached_tokens?: number;
  };
};

type TokenUsageShape = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

function toNonNegativeInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.floor(value);
}

function extractCachedTokens(usageMetadata: UsageMetadata): number | undefined {
  const details = usageMetadata.input_token_details;
  if (!details || typeof details !== "object") {
    return undefined;
  }

  return (
    toNonNegativeInt(details.cache_read) ??
    toNonNegativeInt(details.cached_tokens)
  );
}

export function extractLlmUsageFromMetadata(
  metadata: unknown,
): LlmUsage | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const usageMetadata = (metadata as { usage_metadata?: UsageMetadata })
    .usage_metadata;

  if (!usageMetadata || typeof usageMetadata !== "object") {
    return undefined;
  }

  const promptTokens = toNonNegativeInt(usageMetadata.input_tokens);
  const completionTokens = toNonNegativeInt(usageMetadata.output_tokens);

  if (promptTokens === undefined && completionTokens === undefined) {
    return undefined;
  }

  const cachedTokens = extractCachedTokens(usageMetadata);

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    ...(cachedTokens !== undefined ? { cachedTokens } : {}),
  };
}

export function extractLlmUsageFromTokenUsage(
  tokenUsage: unknown,
): LlmUsage | undefined {
  if (!tokenUsage || typeof tokenUsage !== "object") {
    return undefined;
  }

  const usage = tokenUsage as TokenUsageShape;
  const promptTokens = toNonNegativeInt(usage.promptTokens);
  const completionTokens = toNonNegativeInt(usage.completionTokens);

  if (promptTokens === undefined && completionTokens === undefined) {
    const totalTokens = toNonNegativeInt(usage.totalTokens);
    if (totalTokens === undefined || totalTokens === 0) {
      return undefined;
    }

    return { promptTokens: totalTokens, completionTokens: 0 };
  }

  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
  };
}

export function extractLlmUsageFromLlmOutput(
  llmOutput: unknown,
): LlmUsage | undefined {
  if (!llmOutput || typeof llmOutput !== "object") {
    return undefined;
  }

  const tokenUsage = (llmOutput as { tokenUsage?: unknown }).tokenUsage;
  return extractLlmUsageFromTokenUsage(tokenUsage);
}
