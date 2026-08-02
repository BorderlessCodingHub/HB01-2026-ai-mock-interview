import type { createReviewItemsGeneratorNode } from "@/infrastructure/ai/langgraph/nodes/review-items-generator-node";
import type {
  IReviewItemsGenerator,
  ReviewItemsGeneratorOptions,
  ReviewItemsGeneratorParams,
} from "@/modules/interview/protocols/review-items-generator";
import type { ReviewRepository } from "@/modules/interview/repository/review-repository";

export class ReviewItemsGeneratorAdapter implements IReviewItemsGenerator {
  constructor(
    private readonly generateItems: ReturnType<
      typeof createReviewItemsGeneratorNode
    >,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async generate(
    params: ReviewItemsGeneratorParams,
    options?: ReviewItemsGeneratorOptions,
  ) {
    const existingItems = await this.reviewRepository.listByUserId(
      params.userId,
    );

    return this.generateItems(
      {
        transcript: params.transcript,
        structuredSummary: params.structuredSummary,
        interviewLocale: params.interviewLocale,
        jobDescription: params.jobDescription,
        existingItems: existingItems.map((item) => ({
          topic: item.topic,
          angle: item.angle,
          description: item.description,
          priority: item.priority,
        })),
      },
      options?.callbacks ? { callbacks: options.callbacks } : undefined,
    );
  }
}
