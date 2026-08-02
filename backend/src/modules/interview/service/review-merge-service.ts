import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";

export type ReviewSessionConfirmation =
  | { status: "active"; priority: ReviewPriority }
  | { status: "learned" };

export type ReviewItemInput = {
  topic: string;
  angle: string;
  description: string;
  priority: ReviewPriority;
};

const RANK: Record<ReviewPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function bump(priority: ReviewPriority): ReviewPriority {
  if (priority === "low") {
    return "medium";
  }
  if (priority === "medium") {
    return "high";
  }
  return "high";
}

function maxPriority(a: ReviewPriority, b: ReviewPriority): ReviewPriority {
  return RANK[a] >= RANK[b] ? a : b;
}

function pairKey(topic: string, angle: string): string {
  return `${topic.toLowerCase()}::${angle.toLowerCase()}`;
}

export class ReviewMergeService {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async upsertItems(
    userId: number,
    sessionId: string,
    items: ReviewItemInput[],
  ): Promise<void> {
    const llmPairs = new Set(
      items.map((item) => pairKey(item.topic, item.angle)),
    );

    for (const item of items) {
      const existing =
        (await this.reviewRepository.findByUserIdAndTopicAngleCaseInsensitive(
          userId,
          item.topic,
          item.angle,
        )) ??
        (await this.reviewRepository.findSimilarByUserIdAndTopicAngle(
          userId,
          item.topic,
          item.angle,
        ));

      if (!existing) {
        await this.reviewRepository.upsert({
          userId,
          sessionId,
          topic: item.topic,
          angle: item.angle,
          description: item.description,
          priority: item.priority,
        });
        continue;
      }

      let priority = maxPriority(existing.priority, item.priority);

      if (
        llmPairs.has(pairKey(existing.topic, existing.angle)) &&
        priority === existing.priority
      ) {
        priority = bump(existing.priority);
      }

      await this.reviewRepository.upsert({
        userId,
        sessionId,
        topic: item.topic,
        angle: item.angle,
        description: item.description,
        priority,
      });
    }
  }

  async insertNewTopicsOnly(
    userId: number,
    sessionId: string,
    items: ReviewItemInput[],
  ): Promise<void> {
    for (const item of items) {
      const existing =
        (await this.reviewRepository.findByUserIdAndTopicAngleCaseInsensitive(
          userId,
          item.topic,
          item.angle,
        )) ??
        (await this.reviewRepository.findSimilarByUserIdAndTopicAngle(
          userId,
          item.topic,
          item.angle,
        ));

      if (existing) {
        continue;
      }

      await this.reviewRepository.upsert({
        userId,
        sessionId,
        topic: item.topic,
        angle: item.angle,
        description: item.description,
        priority: item.priority,
      });
    }
  }

  async applyReviewSessionConfirmation(
    userId: number,
    reviewItemId: string,
    resolved: ReviewSessionConfirmation,
  ): Promise<ReviewItemRecord> {
    if (resolved.status === "active") {
      const updated = await this.reviewRepository.updateByIdAndUserId(
        reviewItemId,
        userId,
        {
          status: "active",
          priority: resolved.priority,
          learnedAt: null,
        },
      );

      if (!updated) {
        throw new Error(`Review item not found: ${reviewItemId}`);
      }

      return updated;
    }

    const now = new Date();
    const updated = await this.reviewRepository.updateByIdAndUserId(
      reviewItemId,
      userId,
      {
        status: "learned",
        learnedAt: now,
      },
    );

    if (!updated) {
      throw new Error(`Review item not found: ${reviewItemId}`);
    }

    return updated;
  }
}
