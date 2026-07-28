import prisma from "@/infrastructure/database";
import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type {
  ReviewSessionItemRecord,
  ReviewSessionRecord,
  ReviewSessionTurn,
} from "@/modules/review-sessions/types/review-session-record";
import type { InterviewLocale } from "@/shared";
import type {
  ReviewItemStatus,
  ReviewSession as PrismaReviewSession,
  ReviewSessionItem as PrismaReviewSessionItem,
  ReviewSessionStatus,
  Prisma,
} from "../../../../prisma/generated/client";

export type CreateReviewSessionItemInput = {
  reviewItemId: string;
  topic: string;
  description: string;
  currentPriority: ReviewPriority;
};

export type ReviewSessionSuggestion = {
  status: ReviewItemStatus;
  priority: ReviewPriority | null;
};

export type ReviewSessionConfirmation = {
  status: ReviewItemStatus;
  priority: ReviewPriority | null;
};

function parseTurns(value: Prisma.JsonValue): ReviewSessionTurn[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value as ReviewSessionTurn[];
}

function toReviewSessionItemRecord(
  row: PrismaReviewSessionItem,
): ReviewSessionItemRecord {
  return {
    id: row.id,
    reviewSessionId: row.reviewSessionId,
    reviewItemId: row.reviewItemId,
    order: row.order,
    topic: row.topic,
    description: row.description,
    currentPriority: row.currentPriority as ReviewPriority,
    turns: parseTurns(row.turns),
    pendingQuestion: row.pendingQuestion,
    suggestedStatus: row.suggestedStatus,
    suggestedPriority: row.suggestedPriority as ReviewPriority | null,
    confirmedStatus: row.confirmedStatus,
    confirmedPriority: row.confirmedPriority as ReviewPriority | null,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
  };
}

type ReviewSessionWithItems = PrismaReviewSession & {
  items: PrismaReviewSessionItem[];
};

function toReviewSessionRecord(
  row: ReviewSessionWithItems,
): ReviewSessionRecord {
  return {
    id: row.id,
    userId: row.userId,
    status: row.status,
    interviewLocale: row.interviewLocale,
    createdAt: row.createdAt,
    evaluatedAt: row.evaluatedAt,
    completedAt: row.completedAt,
    items: row.items.map(toReviewSessionItemRecord),
  };
}

export class ReviewSessionRepository {
  async create(
    userId: number,
    items: CreateReviewSessionItemInput[],
    interviewLocale: InterviewLocale,
  ): Promise<ReviewSessionRecord> {
    const row = await prisma.reviewSession.create({
      data: {
        userId,
        interviewLocale,
        items: {
          create: items.map((item, index) => ({
            reviewItemId: item.reviewItemId,
            topic: item.topic,
            description: item.description,
            currentPriority: item.currentPriority,
            order: index,
          })),
        },
      },
      include: {
        items: { orderBy: { order: "asc" } },
      },
    });

    return toReviewSessionRecord(row);
  }

  async findByIdAndUserId(
    sessionId: string,
    userId: number,
  ): Promise<ReviewSessionRecord | null> {
    const row = await prisma.reviewSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        items: { orderBy: { order: "asc" } },
      },
    });

    return row ? toReviewSessionRecord(row) : null;
  }

  async findManyByUserId(params: {
    userId: number;
    statuses: ReviewSessionStatus[];
    skip: number;
    take: number;
  }): Promise<ReviewSessionRecord[]> {
    const rows = await prisma.reviewSession.findMany({
      where: {
        userId: params.userId,
        status: { in: params.statuses },
      },
      orderBy: [
        { completedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      skip: params.skip,
      take: params.take,
      include: {
        items: { orderBy: { order: "asc" } },
      },
    });

    return rows.map(toReviewSessionRecord);
  }

  async appendTurn(
    itemId: string,
    turn: ReviewSessionTurn,
  ): Promise<void> {
    const item = await prisma.reviewSessionItem.findUnique({
      where: { id: itemId },
      select: { turns: true },
    });
    if (!item) {
      return;
    }

    const turns = [...parseTurns(item.turns), turn];

    await prisma.reviewSessionItem.update({
      where: { id: itemId },
      data: {
        turns,
        pendingQuestion: null,
      },
    });
  }

  async setPendingQuestion(
    itemId: string,
    question: string | null,
  ): Promise<void> {
    await prisma.reviewSessionItem.update({
      where: { id: itemId },
      data: { pendingQuestion: question },
    });
  }

  async saveSuggestions(
    itemId: string,
    suggestion: ReviewSessionSuggestion | null,
  ): Promise<void> {
    await prisma.reviewSessionItem.update({
      where: { id: itemId },
      data: {
        suggestedStatus: suggestion?.status ?? null,
        suggestedPriority: suggestion?.priority ?? null,
      },
    });
  }

  async markPendingReview(
    sessionId: string,
    interviewLocale: InterviewLocale,
  ): Promise<void> {
    await prisma.reviewSession.update({
      where: { id: sessionId },
      data: {
        status: "pending_review",
        interviewLocale,
        evaluatedAt: new Date(),
      },
    });
  }

  async confirmItem(
    itemId: string,
    confirmed: ReviewSessionConfirmation,
  ): Promise<void> {
    await prisma.reviewSessionItem.update({
      where: { id: itemId },
      data: {
        confirmedStatus: confirmed.status,
        confirmedPriority: confirmed.priority,
        confirmedAt: new Date(),
      },
    });
  }

  async markCompletedIfAllConfirmed(sessionId: string): Promise<boolean> {
    const session = await prisma.reviewSession.findUnique({
      where: { id: sessionId },
      include: { items: true },
    });
    if (!session || session.items.length === 0) {
      return false;
    }

    const allConfirmed = session.items.every(
      (item) => item.confirmedStatus !== null,
    );
    if (!allConfirmed) {
      return false;
    }

    await prisma.reviewSession.update({
      where: { id: sessionId },
      data: {
        status: "completed",
        completedAt: new Date(),
      },
    });

    return true;
  }
}
