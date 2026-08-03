import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewMergeService } from "@/modules/interview/service/review-merge-service";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { ReviewSessionRepository } from "@/modules/review-sessions/repository/review-session-repository";
import type {
  ReviewSessionItemRecord,
  ReviewSessionRecord,
} from "@/modules/review-sessions/types/review-session-record";
import { BadRequestError, ConflictError, NotFoundError } from "@/shared";

import { ReviewSessionsService } from "./review-sessions-service";

const baseDate = new Date("2026-01-01T00:00:00.000Z");

function createReviewItem(
  overrides: Partial<
    Pick<
      ReviewItemRecord,
      "id" | "topic" | "angle" | "description" | "priority"
    >
  > = {},
): ReviewItemRecord {
  return {
    id: overrides.id ?? "review-item-1",
    userId: 1,
    sessionId: "interview-session-id",
    topic: overrides.topic ?? "system design",
    angle: overrides.angle ?? "sharding strategies",
    description: overrides.description ?? "Need to study sharding",
    priority: overrides.priority ?? "high",
    status: "active",
    learnedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate,
  };
}

function createSessionItem(
  overrides: Partial<ReviewSessionItemRecord> = {},
): ReviewSessionItemRecord {
  return {
    id: overrides.id ?? "session-item-1",
    reviewSessionId: overrides.reviewSessionId ?? "review-session-id",
    reviewItemId: overrides.reviewItemId ?? "review-item-1",
    order: overrides.order ?? 0,
    topic: overrides.topic ?? "system design",
    angle: overrides.angle ?? "sharding strategies",
    description: overrides.description ?? "Need to study sharding",
    currentPriority: overrides.currentPriority ?? "high",
    turns: overrides.turns ?? [],
    pendingQuestion: overrides.pendingQuestion ?? null,
    suggestedStatus: overrides.suggestedStatus ?? null,
    suggestedPriority: overrides.suggestedPriority ?? null,
    confirmedStatus: overrides.confirmedStatus ?? null,
    confirmedPriority: overrides.confirmedPriority ?? null,
    confirmedAt: overrides.confirmedAt ?? null,
    createdAt: overrides.createdAt ?? baseDate,
  };
}

function createReviewSessionRecord(
  overrides: Partial<ReviewSessionRecord> = {},
): ReviewSessionRecord {
  return {
    id: overrides.id ?? "review-session-id",
    userId: overrides.userId ?? 1,
    status: overrides.status ?? "in_progress",
    interviewLocale: overrides.interviewLocale ?? "en",
    createdAt: overrides.createdAt ?? baseDate,
    evaluatedAt: overrides.evaluatedAt ?? null,
    completedAt: overrides.completedAt ?? null,
    items: overrides.items ?? [createSessionItem()],
  };
}

describe("ReviewSessionsService", () => {
  let reviewRepository: ReviewRepository;
  let reviewSessionRepository: ReviewSessionRepository;
  let reviewMergeService: ReviewMergeService;
  let service: ReviewSessionsService;

  beforeEach(() => {
    reviewRepository = {
      findActiveByIdsAndUserId: vi.fn(),
    } as unknown as ReviewRepository;
    reviewSessionRepository = {
      create: vi.fn(),
      findByIdAndUserId: vi.fn(),
      findManyByUserId: vi.fn(),
      confirmItem: vi.fn(),
      markCompletedIfAllConfirmed: vi.fn(),
    } as unknown as ReviewSessionRepository;
    reviewMergeService = {
      applyReviewSessionConfirmation: vi.fn(),
    } as unknown as ReviewMergeService;
    service = new ReviewSessionsService(
      reviewRepository,
      reviewSessionRepository,
      reviewMergeService,
    );
  });

  describe("create", () => {
    it("creates a session when all review items are active and owned", async () => {
      const itemOne = createReviewItem({
        id: "review-item-1",
        topic: "system design",
        angle: "sharding strategies",
        priority: "high",
      });
      const itemTwo = createReviewItem({
        id: "review-item-2",
        topic: "rest apis",
        angle: "http semantics",
        description: "Practice REST semantics",
        priority: "medium",
      });

      vi.mocked(reviewRepository.findActiveByIdsAndUserId).mockResolvedValue([
        itemTwo,
        itemOne,
      ]);
      vi.mocked(reviewSessionRepository.create).mockResolvedValue(
        createReviewSessionRecord({
          items: [
            createSessionItem({
              id: "session-item-1",
              reviewItemId: "review-item-1",
              topic: "system design",
              angle: "sharding strategies",
              currentPriority: "high",
            }),
            createSessionItem({
              id: "session-item-2",
              reviewItemId: "review-item-2",
              order: 1,
              topic: "rest apis",
              angle: "http semantics",
              description: "Practice REST semantics",
              currentPriority: "medium",
            }),
          ],
        }),
      );

      const result = await service.create(1, {
        reviewItemIds: ["review-item-1", "review-item-2"],
        interviewLocale: "pt",
      });

      expect(reviewRepository.findActiveByIdsAndUserId).toHaveBeenCalledWith(1, [
        "review-item-1",
        "review-item-2",
      ]);
      expect(reviewSessionRepository.create).toHaveBeenCalledWith(
        1,
        [
          {
            reviewItemId: "review-item-1",
            topic: "system design",
            angle: "sharding strategies",
            description: "Need to study sharding",
            currentPriority: "high",
          },
          {
            reviewItemId: "review-item-2",
            topic: "rest apis",
            angle: "http semantics",
            description: "Practice REST semantics",
            currentPriority: "medium",
          },
        ],
        "pt",
      );
      expect(result).toEqual({
        id: "review-session-id",
        status: "in_progress",
        items: [
          {
            id: "session-item-1",
            reviewItemId: "review-item-1",
            topic: "system design",
            angle: "sharding strategies",
            currentPriority: "high",
          },
          {
            id: "session-item-2",
            reviewItemId: "review-item-2",
            topic: "rest apis",
            angle: "http semantics",
            currentPriority: "medium",
          },
        ],
      });
    });

    it("throws NotFoundError and does not create a session when any id is missing, not owned, or not active", async () => {
      vi.mocked(reviewRepository.findActiveByIdsAndUserId).mockResolvedValue([
        createReviewItem({ id: "review-item-1" }),
      ]);

      await expect(
        service.create(1, {
          reviewItemIds: ["review-item-1", "review-item-missing"],
          interviewLocale: "en",
        }),
      ).rejects.toBeInstanceOf(NotFoundError);

      expect(reviewSessionRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("returns the report shape for an owned session", async () => {
      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        createReviewSessionRecord({
          status: "pending_review",
          items: [
            createSessionItem({
              suggestedStatus: "active",
              suggestedPriority: "medium",
            }),
          ],
        }),
      );

      const result = await service.getById(1, "review-session-id");

      expect(reviewSessionRepository.findByIdAndUserId).toHaveBeenCalledWith(
        "review-session-id",
        1,
      );
      expect(result).toEqual({
        id: "review-session-id",
        status: "pending_review",
        items: [
          {
            id: "session-item-1",
            reviewItemId: "review-item-1",
            topic: "system design",
            angle: "sharding strategies",
            currentPriority: "high",
            turns: [],
            suggestedStatus: "active",
            suggestedPriority: "medium",
            confirmedStatus: null,
            confirmedPriority: null,
          },
        ],
      });
    });

    it("includes turns on each report item", async () => {
      const turns = [
        { question: "What is sharding?", answer: "It splits data" },
        { question: "Why shard?", answer: "Scale writes" },
      ];

      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        createReviewSessionRecord({
          status: "completed",
          items: [
            createSessionItem({
              turns,
              suggestedStatus: "learned",
              suggestedPriority: null,
              confirmedStatus: "learned",
              confirmedPriority: null,
              confirmedAt: baseDate,
            }),
          ],
        }),
      );

      const result = await service.getById(1, "review-session-id");

      expect(result.items[0]!.turns).toEqual(turns);
    });

    it("throws NotFoundError when the session is missing or not owned", async () => {
      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        null,
      );

      await expect(
        service.getById(1, "missing-session-id"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("list", () => {
    it("maps sessions to list summaries and returns page metadata", async () => {
      const completedAt = new Date("2026-01-02T12:00:00.000Z");

      vi.mocked(reviewSessionRepository.findManyByUserId).mockResolvedValue([
        createReviewSessionRecord({
          id: "session-a",
          status: "completed",
          createdAt: baseDate,
          completedAt,
          items: [
            createSessionItem({ topic: "system design" }),
            createSessionItem({
              id: "session-item-2",
              order: 1,
              topic: "rest apis",
            }),
          ],
        }),
        createReviewSessionRecord({
          id: "session-b",
          status: "in_progress",
          createdAt: baseDate,
          completedAt: null,
          items: [createSessionItem({ topic: "typescript" })],
        }),
      ]);

      const result = await service.list(1, {
        statuses: ["completed", "in_progress"],
        page: 1,
        limit: 10,
      });

      expect(reviewSessionRepository.findManyByUserId).toHaveBeenCalledWith({
        userId: 1,
        statuses: ["completed", "in_progress"],
        skip: 0,
        take: 11,
      });
      expect(result).toEqual({
        sessions: [
          {
            id: "session-a",
            status: "completed",
            topics: [
              "system design — sharding strategies",
              "rest apis — sharding strategies",
            ],
            createdAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-02T12:00:00.000Z",
          },
          {
            id: "session-b",
            status: "in_progress",
            topics: ["typescript — sharding strategies"],
            createdAt: "2026-01-01T00:00:00.000Z",
            completedAt: null,
          },
        ],
        page: 1,
        limit: 10,
        hasMore: false,
      });
    });

    it("sets hasMore true and trims to limit when repo returns limit + 1", async () => {
      vi.mocked(reviewSessionRepository.findManyByUserId).mockResolvedValue([
        createReviewSessionRecord({ id: "session-1" }),
        createReviewSessionRecord({ id: "session-2" }),
        createReviewSessionRecord({ id: "session-3" }),
      ]);

      const result = await service.list(1, {
        statuses: ["completed"],
        page: 2,
        limit: 2,
      });

      expect(reviewSessionRepository.findManyByUserId).toHaveBeenCalledWith({
        userId: 1,
        statuses: ["completed"],
        skip: 2,
        take: 3,
      });
      expect(result.sessions.map((session) => session.id)).toEqual([
        "session-1",
        "session-2",
      ]);
      expect(result.hasMore).toBe(true);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(2);
    });

    it("sets hasMore false when repo returns at most limit rows", async () => {
      vi.mocked(reviewSessionRepository.findManyByUserId).mockResolvedValue([
        createReviewSessionRecord({ id: "session-1" }),
      ]);

      const result = await service.list(1, {
        statuses: ["pending_review"],
        page: 1,
        limit: 10,
      });

      expect(result.hasMore).toBe(false);
      expect(result.sessions).toHaveLength(1);
    });
  });

  describe("apply", () => {
    function mockPendingSessionItem(
      overrides: Partial<ReviewSessionItemRecord> = {},
    ) {
      return createSessionItem({
        suggestedStatus: "active",
        suggestedPriority: "medium",
        ...overrides,
      });
    }

    it("applies all items, marks session completed, and returns the report", async () => {
      const itemOne = mockPendingSessionItem({
        id: "session-item-1",
        reviewItemId: "review-item-1",
      });
      const itemTwo = mockPendingSessionItem({
        id: "session-item-2",
        reviewItemId: "review-item-2",
        order: 1,
        topic: "typescript",
        suggestedStatus: "learned",
        suggestedPriority: null,
      });
      const updatedSession = createReviewSessionRecord({
        status: "completed",
        items: [
          {
            ...itemOne,
            confirmedStatus: "active",
            confirmedPriority: "medium",
            confirmedAt: baseDate,
          },
          {
            ...itemTwo,
            confirmedStatus: "learned",
            confirmedPriority: null,
            confirmedAt: baseDate,
          },
        ],
      });

      vi.mocked(reviewSessionRepository.findByIdAndUserId)
        .mockResolvedValueOnce(
          createReviewSessionRecord({
            status: "pending_review",
            items: [itemOne, itemTwo],
          }),
        )
        .mockResolvedValueOnce(updatedSession);
      vi.mocked(
        reviewMergeService.applyReviewSessionConfirmation,
      ).mockResolvedValue(createReviewItem());
      vi.mocked(
        reviewSessionRepository.markCompletedIfAllConfirmed,
      ).mockResolvedValue(true);

      const result = await service.apply(1, "review-session-id", [
        {
          reviewSessionItemId: "session-item-1",
          status: "active",
          priority: "medium",
        },
        {
          reviewSessionItemId: "session-item-2",
          status: "learned",
        },
      ]);

      expect(reviewMergeService.applyReviewSessionConfirmation).toHaveBeenCalledTimes(
        2,
      );
      expect(reviewSessionRepository.confirmItem).toHaveBeenCalledTimes(2);
      expect(
        reviewSessionRepository.markCompletedIfAllConfirmed,
      ).toHaveBeenCalledWith("review-session-id");
      expect(result.status).toBe("completed");
      expect(result.items).toHaveLength(2);
    });

    it("throws BadRequestError when not all session items are included", async () => {
      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        createReviewSessionRecord({
          status: "pending_review",
          items: [
            mockPendingSessionItem({ id: "session-item-1" }),
            mockPendingSessionItem({ id: "session-item-2", order: 1 }),
          ],
        }),
      );

      await expect(
        service.apply(1, "review-session-id", [
          {
            reviewSessionItemId: "session-item-1",
            status: "active",
            priority: "high",
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestError);

      expect(
        reviewMergeService.applyReviewSessionConfirmation,
      ).not.toHaveBeenCalled();
    });

    it("throws ConflictError when the session is already completed", async () => {
      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        createReviewSessionRecord({
          status: "completed",
          items: [mockPendingSessionItem()],
        }),
      );

      await expect(
        service.apply(1, "review-session-id", [
          {
            reviewSessionItemId: "session-item-1",
            status: "active",
            priority: "high",
          },
        ]),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws ConflictError when any item is already confirmed", async () => {
      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        createReviewSessionRecord({
          status: "pending_review",
          items: [
            mockPendingSessionItem({
              confirmedStatus: "active",
              confirmedPriority: "high",
              confirmedAt: baseDate,
            }),
          ],
        }),
      );

      await expect(
        service.apply(1, "review-session-id", [
          {
            reviewSessionItemId: "session-item-1",
            status: "active",
            priority: "high",
          },
        ]),
      ).rejects.toBeInstanceOf(ConflictError);

      expect(
        reviewMergeService.applyReviewSessionConfirmation,
      ).not.toHaveBeenCalled();
    });

    it("throws NotFoundError when the session or item is missing", async () => {
      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        null,
      );

      await expect(
        service.apply(1, "review-session-id", [
          {
            reviewSessionItemId: "session-item-1",
            status: "active",
            priority: "high",
          },
        ]),
      ).rejects.toBeInstanceOf(NotFoundError);

      vi.mocked(reviewSessionRepository.findByIdAndUserId).mockResolvedValue(
        createReviewSessionRecord({
          status: "pending_review",
          items: [mockPendingSessionItem({ id: "other-item" })],
        }),
      );

      await expect(
        service.apply(1, "review-session-id", [
          {
            reviewSessionItemId: "session-item-1",
            status: "active",
            priority: "high",
          },
        ]),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
