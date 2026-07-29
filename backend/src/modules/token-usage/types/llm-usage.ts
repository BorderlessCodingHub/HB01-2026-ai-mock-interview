export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  /** Input tokens served from OpenAI prompt cache, when reported. */
  cachedTokens?: number;
};

export function getTotalTokens(usage: LlmUsage): number {
  return usage.promptTokens + usage.completionTokens;
}
