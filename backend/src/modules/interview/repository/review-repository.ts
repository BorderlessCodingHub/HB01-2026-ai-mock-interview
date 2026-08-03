import prisma from "@/infrastructure/database";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type {
  ReviewItem as PrismaReviewItem,
  ReviewItemStatus,
} from "../../../../prisma/generated/client";

export type UpdateReviewItemByIdParams = {
  status: ReviewItemStatus;
  priority?: ReviewPriority;
  learnedAt: Date | null;
};

export type UpsertReviewItemParams = {
  userId: number;
  sessionId: string;
  topic: string;
  angle: string;
  description: string;
  priority: ReviewPriority;
};

function normalizeLabel(value: string): string {
  return value.toLowerCase();
}

function toReviewItemRecord(row: PrismaReviewItem): ReviewItemRecord {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    topic: row.topic,
    angle: row.angle,
    description: row.description,
    priority: row.priority as ReviewPriority,
    status: row.status,
    learnedAt: row.learnedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const PAIR_SIMILARITY_THRESHOLD = 0.7;

export class ReviewRepository {
  async listByUserId(userId: number): Promise<ReviewItemRecord[]> {
    const rows = await prisma.reviewItem.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toReviewItemRecord);
  }

  async deleteByIdAndUserId(id: string, userId: number): Promise<boolean> {
    const result = await prisma.reviewItem.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async findActiveByIdsAndUserId(
    userId: number,
    ids: string[],
  ): Promise<ReviewItemRecord[]> {
    if (ids.length === 0) {
      return [];
    }

    const rows = await prisma.reviewItem.findMany({
      where: {
        userId,
        id: { in: ids },
        status: "active",
      },
    });
    return rows.map(toReviewItemRecord);
  }

  async findByUserIdAndTopicAngleCaseInsensitive(
    userId: number,
    topic: string,
    angle: string,
  ): Promise<ReviewItemRecord | null> {
    const row = await prisma.reviewItem.findFirst({
      where: {
        userId,
        topic: normalizeLabel(topic),
        angle: normalizeLabel(angle),
      },
    });
    return row ? toReviewItemRecord(row) : null;
  }

  /** @deprecated Prefer findByUserIdAndTopicAngleCaseInsensitive */
  async findByUserIdAndTopicCaseInsensitive(
    userId: number,
    topic: string,
  ): Promise<ReviewItemRecord | null> {
    const row = await prisma.reviewItem.findFirst({
      where: {
        userId,
        topic: normalizeLabel(topic),
      },
    });
    return row ? toReviewItemRecord(row) : null;
  }

  async findSimilarByUserIdAndTopicAngle(
    userId: number,
    topic: string,
    angle: string,
    threshold: number = PAIR_SIMILARITY_THRESHOLD,
  ): Promise<ReviewItemRecord | null> {
    const normalizedTopic = normalizeLabel(topic);
    const normalizedAngle = normalizeLabel(angle);
    const searchPhrase = `${normalizedTopic} ${normalizedAngle}`;
    const matches = await prisma.$queryRaw<PrismaReviewItem[]>`
      SELECT *
      FROM "review_items"
      WHERE "user_id" = ${userId}
        AND similarity("topic" || ' ' || "angle", ${searchPhrase}) >= ${threshold}
      ORDER BY similarity("topic" || ' ' || "angle", ${searchPhrase}) DESC
      LIMIT 1
    `;

    const row = matches[0];
    return row ? toReviewItemRecord(row) : null;
  }

  /** @deprecated Prefer findSimilarByUserIdAndTopicAngle */
  async findSimilarByUserIdAndTopic(
    userId: number,
    topic: string,
    threshold: number = PAIR_SIMILARITY_THRESHOLD,
  ): Promise<ReviewItemRecord | null> {
    const normalizedTopic = normalizeLabel(topic);
    const matches = await prisma.$queryRaw<PrismaReviewItem[]>`
      SELECT *
      FROM "review_items"
      WHERE "user_id" = ${userId}
        AND similarity("topic", ${normalizedTopic}) >= ${threshold}
      ORDER BY similarity("topic", ${normalizedTopic}) DESC
      LIMIT 1
    `;

    const row = matches[0];
    return row ? toReviewItemRecord(row) : null;
  }

  async updateByIdAndUserId(
    id: string,
    userId: number,
    params: UpdateReviewItemByIdParams,
  ): Promise<ReviewItemRecord | null> {
    const result = await prisma.reviewItem.updateMany({
      where: { id, userId },
      data: {
        status: params.status,
        ...(params.priority !== undefined && { priority: params.priority }),
        learnedAt: params.learnedAt,
        updatedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return null;
    }

    const row = await prisma.reviewItem.findFirst({
      where: { id, userId },
    });
    return row ? toReviewItemRecord(row) : null;
  }

  async upsert(params: UpsertReviewItemParams): Promise<ReviewItemRecord> {
    const { userId, sessionId, description, priority } = params;
    const topic = normalizeLabel(params.topic);
    const angle = normalizeLabel(params.angle);

    const row = await prisma.reviewItem.upsert({
      where: {
        userId_topic_angle: { userId, topic, angle },
      },
      create: {
        userId,
        sessionId,
        topic,
        angle,
        description,
        priority,
      },
      update: {
        sessionId,
        description,
        priority,
      },
    });
    return toReviewItemRecord(row);
  }
}
