import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import { NotFoundError } from "@/shared";

import { ReviewItemsService } from "./review-items-service";

const baseDate = new Date("2026-01-01T00:00:00.000Z");

function createReviewItem(
  overrides: Partial<
    Pick<
      ReviewItemRecord,
      "id" | "topic" | "angle" | "priority" | "status" | "learnedAt" | "updatedAt"
    >
  > = {},
): ReviewItemRecord {
  return {
    id: overrides.id ?? "review-id",
    userId: 1,
    sessionId: "session-id",
    topic: overrides.topic ?? "topic",
    angle: overrides.angle ?? "general",
    description: "description",
    priority: overrides.priority ?? "medium",
    status: overrides.status ?? "active",
    learnedAt: overrides.learnedAt ?? null,
    createdAt: baseDate,
    updatedAt: overrides.updatedAt ?? baseDate,
  };
}

describe("ReviewItemsService", () => {
  let reviewRepository: ReviewRepository;
  let service: ReviewItemsService;

  beforeEach(() => {
    reviewRepository = {
      listByUserId: vi.fn(),
      updateByIdAndUserId: vi.fn(),
      deleteByIdAndUserId: vi.fn(),
    } as unknown as ReviewRepository;
    service = new ReviewItemsService(reviewRepository);
  });

  describe("listForUser", () => {
    it("returns active items sorted by priority desc then updatedAt desc by default", async () => {
      vi.mocked(reviewRepository.listByUserId).mockResolvedValue([
        createReviewItem({
          id: "low-old",
          topic: "low topic",
          priority: "low",
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        createReviewItem({
          id: "high-new",
          topic: "high topic",
          priority: "high",
          updatedAt: new Date("2026-01-03T00:00:00.000Z"),
        }),
        createReviewItem({
          id: "medium-mid",
          topic: "medium topic",
          priority: "medium",
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
        createReviewItem({
          id: "high-old",
          topic: "high older",
          priority: "high",
          updatedAt: new Date("2026-01-01T12:00:00.000Z"),
        }),
        createReviewItem({
          id: "learned-item",
          status: "learned",
          learnedAt: new Date("2026-01-04T00:00:00.000Z"),
          priority: "high",
        }),
      ]);

      const result = await service.listForUser(1);

      expect(reviewRepository.listByUserId).toHaveBeenCalledWith(1);
      expect(result.map((item) => item.id)).toEqual([
        "high-new",
        "high-old",
        "medium-mid",
        "low-old",
      ]);
      expect(result[0]).toMatchObject({
        priority: "high",
        status: "active",
        learnedAt: null,
        createdAt: baseDate.toISOString(),
        updatedAt: "2026-01-03T00:00:00.000Z",
      });
    });

    it("returns learned items sorted by learnedAt desc with updatedAt fallback", async () => {
      vi.mocked(reviewRepository.listByUserId).mockResolvedValue([
        createReviewItem({
          id: "active-item",
          status: "active",
        }),
        createReviewItem({
          id: "learned-newer",
          status: "learned",
          learnedAt: new Date("2026-01-03T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
        createReviewItem({
          id: "learned-older",
          status: "learned",
          learnedAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-04T00:00:00.000Z"),
        }),
        createReviewItem({
          id: "learned-fallback",
          status: "learned",
          learnedAt: null,
          updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        }),
      ]);

      const result = await service.listForUser(1, "learned");

      expect(result.map((item) => item.id)).toEqual([
        "learned-newer",
        "learned-fallback",
        "learned-older",
      ]);
    });

    it("returns both active and learned items when status is all", async () => {
      vi.mocked(reviewRepository.listByUserId).mockResolvedValue([
        createReviewItem({
          id: "active-item",
          priority: "low",
        }),
        createReviewItem({
          id: "learned-item",
          status: "learned",
          learnedAt: new Date("2026-01-02T00:00:00.000Z"),
          priority: "high",
        }),
      ]);

      const result = await service.listForUser(1, "all");

      expect(result.map((item) => item.id).sort()).toEqual([
        "active-item",
        "learned-item",
      ]);
    });

    it("returns empty array when user has no review items", async () => {
      vi.mocked(reviewRepository.listByUserId).mockResolvedValue([]);

      const result = await service.listForUser(42);

      expect(result).toEqual([]);
    });
  });

  describe("updateStatus", () => {
    it("marks an owned item as learned and sets learnedAt", async () => {
      const learnedAt = new Date("2026-01-05T12:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(learnedAt);

      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(
        createReviewItem({
          id: "review-id",
          status: "learned",
          learnedAt,
          updatedAt: learnedAt,
        }),
      );

      const result = await service.updateStatus(1, "review-id", "learned");

      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledWith(
        "review-id",
        1,
        { status: "learned", learnedAt },
      );
      expect(result).toMatchObject({
        id: "review-id",
        status: "learned",
        learnedAt: learnedAt.toISOString(),
      });

      vi.useRealTimers();
    });

    it("reactivates a learned item and clears learnedAt", async () => {
      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(
        createReviewItem({
          id: "review-id",
          status: "active",
          learnedAt: null,
          updatedAt: new Date("2026-01-06T00:00:00.000Z"),
        }),
      );

      const result = await service.updateStatus(1, "review-id", "active");

      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledWith(
        "review-id",
        1,
        { status: "active", learnedAt: null },
      );
      expect(result).toMatchObject({
        id: "review-id",
        status: "active",
        learnedAt: null,
      });
    });

    it("throws NotFoundError when the review item is missing or not owned", async () => {
      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(null);

      await expect(
        service.updateStatus(1, "missing-id", "learned"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("deleteForUser", () => {
    it("deletes the review item when it belongs to the user", async () => {
      vi.mocked(reviewRepository.deleteByIdAndUserId).mockResolvedValue(true);

      await service.deleteForUser(1, "review-id");

      expect(reviewRepository.deleteByIdAndUserId).toHaveBeenCalledWith(
        "review-id",
        1,
      );
    });

    it("throws NotFoundError when the review item is missing or not owned", async () => {
      vi.mocked(reviewRepository.deleteByIdAndUserId).mockResolvedValue(false);

      await expect(
        service.deleteForUser(1, "missing-id"),
      ).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});
