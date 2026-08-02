import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type { ReviewItemResponse } from "@/modules/review-items/validations/review-items-schemas";
import type { ReviewItemStatus } from "../../../../prisma/generated/client";
import { NotFoundError } from "@/shared";

const PRIORITY_RANK: Record<ReviewPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

type ReviewItemListStatus = "active" | "learned" | "all";

function toResponse(item: ReviewItemRecord): ReviewItemResponse {
  return {
    id: item.id,
    sessionId: item.sessionId,
    topic: item.topic,
    angle: item.angle,
    description: item.description,
    priority: item.priority,
    status: item.status,
    learnedAt: item.learnedAt?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function compareReviewItems(a: ReviewItemRecord, b: ReviewItemRecord): number {
  const priorityDiff = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority];

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

function compareLearnedReviewItems(
  a: ReviewItemRecord,
  b: ReviewItemRecord,
): number {
  const aLearnedAt = a.learnedAt?.getTime() ?? a.updatedAt.getTime();
  const bLearnedAt = b.learnedAt?.getTime() ?? b.updatedAt.getTime();

  return bLearnedAt - aLearnedAt;
}

function filterByStatus(
  items: ReviewItemRecord[],
  status: ReviewItemListStatus,
): ReviewItemRecord[] {
  if (status === "all") {
    return items;
  }

  return items.filter((item) => item.status === status);
}

function sortReviewItems(
  items: ReviewItemRecord[],
  status: ReviewItemListStatus,
): ReviewItemRecord[] {
  const comparator =
    status === "learned" ? compareLearnedReviewItems : compareReviewItems;

  return [...items].sort(comparator);
}

export class ReviewItemsService {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async listForUser(
    userId: number,
    status: ReviewItemListStatus = "active",
  ): Promise<ReviewItemResponse[]> {
    const items = await this.reviewRepository.listByUserId(userId);
    return sortReviewItems(filterByStatus(items, status), status).map(
      toResponse,
    );
  }

  async updateStatus(
    userId: number,
    id: string,
    status: ReviewItemStatus,
  ): Promise<ReviewItemResponse> {
    const learnedAt = status === "learned" ? new Date() : null;
    const updated = await this.reviewRepository.updateByIdAndUserId(
      id,
      userId,
      { status, learnedAt },
    );

    if (!updated) {
      throw new NotFoundError("Review item not found");
    }

    return toResponse(updated);
  }

  async deleteForUser(userId: number, id: string): Promise<void> {
    const deleted = await this.reviewRepository.deleteByIdAndUserId(id, userId);

    if (!deleted) {
      throw new NotFoundError("Review item not found");
    }
  }
}
