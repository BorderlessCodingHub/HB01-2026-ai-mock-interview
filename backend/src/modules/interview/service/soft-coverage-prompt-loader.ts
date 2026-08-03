import {
  ACTIVE_REVIEW_PROMPT_LIMIT,
  TOPIC_COVERAGE_PROMPT_LIMIT,
} from "@/modules/interview/constants/topic-coverage";
import type { TopicCoverageRepository } from "@/modules/interview/repository/topic-coverage-repository";
import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";

export type SoftCoverageHint = {
  topic: string;
  angle: string;
  createdAt: Date;
};

export type ActiveReviewHint = {
  topic: string;
  priority: ReviewPriority;
  description?: string;
};

export type SoftCoverageHints = {
  coverage: SoftCoverageHint[];
  activeReviews: ActiveReviewHint[];
};

const PRIORITY_RANK: Record<ReviewPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

function compareActiveReviews(a: ReviewItemRecord, b: ReviewItemRecord): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function toActiveReviewHint(item: ReviewItemRecord): ActiveReviewHint {
  return {
    topic: item.topic,
    priority: item.priority,
    description: item.description,
  };
}

export class SoftCoveragePromptLoader {
  constructor(
    private readonly topicCoverageRepository: TopicCoverageRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async loadSoftCoverageHints(userId: number): Promise<SoftCoverageHints> {
    const coverageRows = await this.topicCoverageRepository.listRecentByUserId(
      userId,
      TOPIC_COVERAGE_PROMPT_LIMIT,
    );

    const reviewRows = await this.reviewRepository.listByUserId(userId);
    const activeReviews = reviewRows
      .filter((item) => item.status === "active")
      .sort(compareActiveReviews)
      .slice(0, ACTIVE_REVIEW_PROMPT_LIMIT)
      .map(toActiveReviewHint);

    return {
      coverage: coverageRows.map((row) => ({
        topic: row.topic,
        angle: row.angle,
        createdAt: row.createdAt,
      })),
      activeReviews,
    };
  }
}
