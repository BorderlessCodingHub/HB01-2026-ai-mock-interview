import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { ChatOpenAI } from "@langchain/openai";

import { createReviewModel } from "@/infrastructure/ai/openai-models";
import { buildTopicCoverageGeneratorPrompt } from "@/modules/interview/prompts/topic-coverage-generator-prompt";
import {
  topicCoverageGeneratorOutputSchema,
  type TopicCoverageGeneratorOutput,
} from "@/modules/interview/validations/interview-schemas";
import type { InterviewLocale } from "@/shared/interview-locale/interview-locale";

export type TopicCoverageGeneratorInput = {
  transcript: string;
  interviewLocale: InterviewLocale;
  jobDescription?: string | null;
};

export type StructuredTopicCoverageModel = {
  invoke: (input: unknown) => Promise<unknown>;
};

export type TopicCoverageGeneratorNodeDeps = {
  model?: ChatOpenAI;
  structuredModel?: StructuredTopicCoverageModel;
};

export function createTopicCoverageGeneratorNode(
  deps: TopicCoverageGeneratorNodeDeps = {},
) {
  const structuredModel =
    deps.structuredModel ??
    (deps.model ?? createReviewModel()).withStructuredOutput(
      topicCoverageGeneratorOutputSchema,
    );

  return async function topicCoverageGeneratorNode(
    input: TopicCoverageGeneratorInput,
    config?: RunnableConfig,
  ): Promise<TopicCoverageGeneratorOutput> {
    const promptText = buildTopicCoverageGeneratorPrompt({
      transcript: input.transcript,
      interviewLocale: input.interviewLocale,
      jobDescription: input.jobDescription,
    });

    // Pass prompt as a template variable so transcript content is not parsed
    // as LangChain input placeholders (INVALID_PROMPT_INPUT).
    const promptTemplate = ChatPromptTemplate.fromMessages([
      ["human", "{prompt}"],
    ]);
    const chain = promptTemplate.pipe(structuredModel);
    const invokeInput = { prompt: promptText };
    const raw = config
      ? await chain.invoke(invokeInput, config)
      : await chain.invoke(invokeInput);
    return topicCoverageGeneratorOutputSchema.parse(raw);
  };
}
