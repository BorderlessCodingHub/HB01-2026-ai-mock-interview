import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";

import type { TopicCoverageGeneratorOutput } from "@/modules/interview/validations/interview-schemas";
import type { InterviewLocale } from "@/shared/interview-locale/interview-locale";

export type TopicCoverageGeneratorParams = {
  transcript: string;
  interviewLocale: InterviewLocale;
  jobDescription?: string | null;
};

export type TopicCoverageGeneratorOptions = {
  callbacks?: BaseCallbackHandler[];
};

export interface ITopicCoverageGenerator {
  generate(
    params: TopicCoverageGeneratorParams,
    options?: TopicCoverageGeneratorOptions,
  ): Promise<TopicCoverageGeneratorOutput>;
}
