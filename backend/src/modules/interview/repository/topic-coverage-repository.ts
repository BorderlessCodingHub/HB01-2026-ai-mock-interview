import prisma from "@/infrastructure/database";
import type { TopicCoverageRecord } from "@/modules/interview/types/topic-coverage-record";
import type { TopicCoverage as PrismaTopicCoverage } from "../../../../prisma/generated/client";

export type CreateTopicCoverageParams = {
  userId: number;
  sessionId: string;
  topic: string;
  angle: string;
};

function toTopicCoverageRecord(row: PrismaTopicCoverage): TopicCoverageRecord {
  return {
    id: row.id,
    userId: row.userId,
    sessionId: row.sessionId,
    topic: row.topic,
    angle: row.angle,
    createdAt: row.createdAt,
  };
}

export class TopicCoverageRepository {
  async createMany(rows: CreateTopicCoverageParams[]): Promise<void> {
    if (rows.length === 0) {
      return;
    }

    await prisma.topicCoverage.createMany({ data: rows });
  }

  async listRecentByUserId(
    userId: number,
    limit: number,
  ): Promise<TopicCoverageRecord[]> {
    const rows = await prisma.topicCoverage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(toTopicCoverageRecord);
  }

  async countBySessionId(sessionId: string): Promise<number> {
    return prisma.topicCoverage.count({ where: { sessionId } });
  }

  async pruneOldestBeyondLimit(userId: number, keep: number): Promise<number> {
    const rowsToKeep = await prisma.topicCoverage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: keep,
      select: { id: true },
    });

    const idsToKeep = rowsToKeep.map((row) => row.id);

    if (idsToKeep.length === 0) {
      return 0;
    }

    const result = await prisma.topicCoverage.deleteMany({
      where: {
        userId,
        id: { notIn: idsToKeep },
      },
    });

    return result.count;
  }
}
