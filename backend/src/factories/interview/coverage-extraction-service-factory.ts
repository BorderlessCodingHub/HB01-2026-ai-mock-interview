import { makeTokenUsageService } from "@/factories/token-usage/token-usage-service-factory";
import { createTopicCoverageGeneratorNode } from "@/infrastructure/ai/langgraph/nodes/topic-coverage-generator-node";
import { TopicCoverageGeneratorAdapter } from "@/infrastructure/ai/langgraph/topic-coverage-generator-adapter";
import { MessageRepository } from "@/modules/interview/repository/message-repository";
import { SessionRepository } from "@/modules/interview/repository/session-repository";
import { TopicCoverageRepository } from "@/modules/interview/repository/topic-coverage-repository";
import { CoverageExtractionService } from "@/modules/interview/service/coverage-extraction-service";

export function makeCoverageExtractionService(): CoverageExtractionService {
  return new CoverageExtractionService(
    new SessionRepository(),
    new MessageRepository(),
    new TopicCoverageGeneratorAdapter(createTopicCoverageGeneratorNode()),
    new TopicCoverageRepository(),
    makeTokenUsageService(),
  );
}
