import type { createTopicCoverageGeneratorNode } from "@/infrastructure/ai/langgraph/nodes/topic-coverage-generator-node";
import type {
  ITopicCoverageGenerator,
  TopicCoverageGeneratorOptions,
  TopicCoverageGeneratorParams,
} from "@/modules/interview/protocols/topic-coverage-generator";

export class TopicCoverageGeneratorAdapter implements ITopicCoverageGenerator {
  constructor(
    private readonly generateItems: ReturnType<
      typeof createTopicCoverageGeneratorNode
    >,
  ) {}

  async generate(
    params: TopicCoverageGeneratorParams,
    options?: TopicCoverageGeneratorOptions,
  ) {
    return this.generateItems(
      {
        transcript: params.transcript,
        interviewLocale: params.interviewLocale,
        jobDescription: params.jobDescription,
      },
      options?.callbacks ? { callbacks: options.callbacks } : undefined,
    );
  }
}
