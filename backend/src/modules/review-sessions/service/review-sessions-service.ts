import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewMergeService } from "@/modules/interview/service/review-merge-service";
import type { ReviewSessionConfirmation as MergeConfirmation } from "@/modules/interview/service/review-merge-service";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type { ReviewSessionRepository } from "@/modules/review-sessions/repository/review-session-repository";
import type { ReviewSessionConfirmation } from "@/modules/review-sessions/repository/review-session-repository";
import type {
  ReviewSessionItemRecord,
  ReviewSessionRecord,
  ReviewSessionTurn,
} from "@/modules/review-sessions/types/review-session-record";
import type {
  ApplyReviewSessionInput,
  CreateReviewSessionInput,
} from "@/modules/review-sessions/validations/review-session-schemas";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@/shared";
import type {
  ReviewItemStatus,
  ReviewSessionStatus,
} from "../../../../prisma/generated/client";

export type ReviewSessionSummaryItem = {
  id: string;
  reviewItemId: string;
  topic: string;
  angle: string;
  currentPriority: ReviewPriority;
};

export type ReviewSessionSummary = {
  id: string;
  status: ReviewSessionStatus;
  items: ReviewSessionSummaryItem[];
};

export type ReviewSessionListSummary = {
  id: string;
  status: ReviewSessionStatus;
  topics: string[];
  createdAt: string;
  completedAt: string | null;
};

export type ListReviewSessionsResult = {
  sessions: ReviewSessionListSummary[];
  page: number;
  limit: number;
  hasMore: boolean;
};

export type ReviewSessionReportItem = {
  id: string;
  reviewItemId: string;
  topic: string;
  angle: string;
  currentPriority: ReviewPriority;
  turns: ReviewSessionTurn[];
  suggestedStatus: ReviewItemStatus | null;
  suggestedPriority: ReviewPriority | null;
  confirmedStatus: ReviewItemStatus | null;
  confirmedPriority: ReviewPriority | null;
};

export type ReviewSessionReport = {
  id: string;
  status: ReviewSessionStatus;
  items: ReviewSessionReportItem[];
};

function formatTopicAngleLabel(topic: string, angle: string): string {
  return `${topic} — ${angle}`;
}

function toSummaryItem(
  item: ReviewSessionItemRecord,
): ReviewSessionSummaryItem {
  return {
    id: item.id,
    reviewItemId: item.reviewItemId,
    topic: item.topic,
    angle: item.angle,
    currentPriority: item.currentPriority,
  };
}

function toReportItem(item: ReviewSessionItemRecord): ReviewSessionReportItem {
  return {
    id: item.id,
    reviewItemId: item.reviewItemId,
    topic: item.topic,
    angle: item.angle,
    currentPriority: item.currentPriority,
    turns: item.turns,
    suggestedStatus: item.suggestedStatus,
    suggestedPriority: item.suggestedPriority,
    confirmedStatus: item.confirmedStatus,
    confirmedPriority: item.confirmedPriority,
  };
}

function toSummary(session: ReviewSessionRecord): ReviewSessionSummary {
  return {
    id: session.id,
    status: session.status,
    items: session.items.map(toSummaryItem),
  };
}

function toListSummary(session: ReviewSessionRecord): ReviewSessionListSummary {
  return {
    id: session.id,
    status: session.status,
    topics: session.items.map((item) =>
      formatTopicAngleLabel(item.topic, item.angle),
    ),
    createdAt: session.createdAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
  };
}

function toReport(session: ReviewSessionRecord): ReviewSessionReport {
  return {
    id: session.id,
    status: session.status,
    items: session.items.map(toReportItem),
  };
}

function toMergeConfirmation(
  item: ApplyReviewSessionInput["items"][number],
): MergeConfirmation {
  if (item.status === "active") {
    return { status: "active", priority: item.priority! };
  }

  return { status: "learned" };
}

function toSessionItemConfirmation(
  resolved: MergeConfirmation,
): ReviewSessionConfirmation {
  if (resolved.status === "active") {
    return {
      status: "active",
      priority: resolved.priority,
    };
  }

  return { status: "learned", priority: null };
}

function buildCreateInputs(
  reviewItemIds: string[],
  matches: ReviewItemRecord[],
) {
  const matchById = new Map(matches.map((item) => [item.id, item]));

  return reviewItemIds.map((id) => {
    const item = matchById.get(id)!;
    return {
      reviewItemId: item.id,
      topic: item.topic,
      angle: item.angle,
      description: item.description,
      currentPriority: item.priority,
    };
  });
}

export class ReviewSessionsService {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly reviewSessionRepository: ReviewSessionRepository,
    private readonly reviewMergeService: ReviewMergeService,
  ) {}

  async create(
    userId: number,
    input: CreateReviewSessionInput,
  ): Promise<ReviewSessionSummary> {
    const { reviewItemIds, interviewLocale } = input;
    const matches = await this.reviewRepository.findActiveByIdsAndUserId(
      userId,
      reviewItemIds,
    );

    if (matches.length !== reviewItemIds.length) {
      throw new NotFoundError("Review item not found");
    }

    const session = await this.reviewSessionRepository.create(
      userId,
      buildCreateInputs(reviewItemIds, matches),
      interviewLocale,
    );

    return toSummary(session);
  }

  async getById(
    userId: number,
    sessionId: string,
  ): Promise<ReviewSessionReport> {
    const session = await this.reviewSessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError("Review session not found");
    }

    return toReport(session);
  }

  async list(
    userId: number,
    params: {
      statuses: ReviewSessionStatus[];
      page: number;
      limit: number;
    },
  ): Promise<ListReviewSessionsResult> {
    const { statuses, page, limit } = params;
    const skip = (page - 1) * limit;
    const rows = await this.reviewSessionRepository.findManyByUserId({
      userId,
      statuses,
      skip,
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sessions = rows.slice(0, limit).map(toListSummary);

    return { sessions, page, limit, hasMore };
  }

  async apply(
    userId: number,
    sessionId: string,
    items: ApplyReviewSessionInput["items"],
  ): Promise<ReviewSessionReport> {
    const session = await this.reviewSessionRepository.findByIdAndUserId(
      sessionId,
      userId,
    );

    if (!session) {
      throw new NotFoundError("Review session not found");
    }

    if (session.status === "completed") {
      throw new ConflictError("Review session already completed");
    }

    if (session.status !== "pending_review") {
      throw new BadRequestError("Review session is not pending review");
    }

    if (items.length !== session.items.length) {
      throw new BadRequestError("All session items must be included");
    }

    if (session.items.some((item) => item.confirmedStatus !== null)) {
      throw new ConflictError("Review session item already confirmed");
    }

    const sessionItemById = new Map(
      session.items.map((item) => [item.id, item]),
    );

    for (const applyItem of items) {
      const sessionItem = sessionItemById.get(applyItem.reviewSessionItemId);

      if (!sessionItem) {
        throw new NotFoundError("Review session item not found");
      }

      const resolved = toMergeConfirmation(applyItem);

      await this.reviewMergeService.applyReviewSessionConfirmation(
        userId,
        sessionItem.reviewItemId,
        resolved,
      );

      await this.reviewSessionRepository.confirmItem(
        sessionItem.id,
        toSessionItemConfirmation(resolved),
      );
    }

    await this.reviewSessionRepository.markCompletedIfAllConfirmed(sessionId);

    const updatedSession =
      await this.reviewSessionRepository.findByIdAndUserId(sessionId, userId);

    return toReport(updatedSession!);
  }
}
