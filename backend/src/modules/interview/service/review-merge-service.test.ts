import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";

import { ReviewMergeService } from "./review-merge-service";

function existingItem(
  overrides: Partial<ReviewItemRecord> = {},
): ReviewItemRecord {
  return {
    id: "item-1",
    userId: 1,
    sessionId: "old-session",
    topic: "communication",
    angle: "conciseness under pressure",
    description: "Old",
    priority: "low",
    status: "active",
    learnedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("ReviewMergeService", () => {
  let reviewRepository: ReviewRepository;
  let service: ReviewMergeService;

  beforeEach(() => {
    reviewRepository = {
      findByUserIdAndTopicAngleCaseInsensitive: vi.fn(),
      findSimilarByUserIdAndTopicAngle: vi.fn(),
      upsert: vi.fn(),
      updateByIdAndUserId: vi.fn(),
    } as unknown as ReviewRepository;

    service = new ReviewMergeService(reviewRepository);
  });

  it("inserts a new review item when topic+angle does not exist", async () => {
    vi.mocked(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).mockResolvedValue(null);
    vi.mocked(
      reviewRepository.findSimilarByUserIdAndTopicAngle,
    ).mockResolvedValue(null);

    await service.upsertItems(1, "session-1", [
      {
        topic: "Communication",
        angle: "conciseness under pressure",
        description: "Be concise",
        priority: "medium",
      },
    ]);

    expect(reviewRepository.upsert).toHaveBeenCalledWith({
      userId: 1,
      sessionId: "session-1",
      topic: "Communication",
      angle: "conciseness under pressure",
      description: "Be concise",
      priority: "medium",
    });
  });

  it("uses max priority when LLM raises priority", async () => {
    vi.mocked(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).mockResolvedValue(
      existingItem({ topic: "communication", priority: "low" }),
    );

    await service.upsertItems(1, "session-1", [
      {
        topic: "Communication",
        angle: "conciseness under pressure",
        description: "Be concise",
        priority: "high",
      },
    ]);

    expect(reviewRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "high",
        description: "Be concise",
        angle: "conciseness under pressure",
      }),
    );
  });

  it("bumps priority when LLM keeps same priority for existing pair", async () => {
    vi.mocked(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).mockResolvedValue(
      existingItem({ topic: "communication", priority: "medium" }),
    );

    await service.upsertItems(1, "session-1", [
      {
        topic: "Communication",
        angle: "conciseness under pressure",
        description: "Updated",
        priority: "medium",
      },
    ]);

    expect(reviewRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "high",
      }),
    );
  });

  it("matches existing pairs case-insensitively", async () => {
    vi.mocked(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).mockResolvedValue(
      existingItem({
        topic: "system design",
        angle: "sharding trade-offs",
        priority: "low",
      }),
    );

    await service.upsertItems(1, "session-1", [
      {
        topic: "System Design",
        angle: "Sharding Trade-offs",
        description: "Updated",
        priority: "medium",
      },
    ]);

    expect(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).toHaveBeenCalledWith(1, "System Design", "Sharding Trade-offs");
    expect(reviewRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "System Design",
        angle: "Sharding Trade-offs",
        priority: "medium",
      }),
    );
  });

  it("never decreases priority when LLM sends a lower priority", async () => {
    vi.mocked(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).mockResolvedValue(
      existingItem({ topic: "communication", priority: "high" }),
    );

    await service.upsertItems(1, "session-1", [
      {
        topic: "Communication",
        angle: "conciseness under pressure",
        description: "Updated",
        priority: "low",
      },
    ]);

    expect(reviewRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "high",
      }),
    );
  });

  it("falls back to similarity lookup when exact normalized pair is missing", async () => {
    vi.mocked(
      reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
    ).mockResolvedValue(null);
    vi.mocked(
      reviewRepository.findSimilarByUserIdAndTopicAngle,
    ).mockResolvedValue(
      existingItem({
        topic: "distributed systems",
        angle: "consistency models",
        priority: "medium",
      }),
    );

    await service.upsertItems(1, "session-1", [
      {
        topic: "Distributed System Design",
        angle: "consistency model trade-offs",
        description: "Clarify trade-offs",
        priority: "high",
      },
    ]);

    expect(
      reviewRepository.findSimilarByUserIdAndTopicAngle,
    ).toHaveBeenCalledWith(
      1,
      "Distributed System Design",
      "consistency model trade-offs",
    );
    expect(reviewRepository.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: "high",
      }),
    );
  });

  describe("insertNewTopicsOnly", () => {
    it("inserts a new review item when no existing or similar match", async () => {
      vi.mocked(
        reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
      ).mockResolvedValue(null);
      vi.mocked(
        reviewRepository.findSimilarByUserIdAndTopicAngle,
      ).mockResolvedValue(null);

      await service.insertNewTopicsOnly(1, "session-1", [
        {
          topic: "Communication",
          angle: "conciseness under pressure",
          description: "Be concise",
          priority: "medium",
        },
      ]);

      expect(reviewRepository.upsert).toHaveBeenCalledWith({
        userId: 1,
        sessionId: "session-1",
        topic: "Communication",
        angle: "conciseness under pressure",
        description: "Be concise",
        priority: "medium",
      });
    });

    it("inserts when same topic has a different angle", async () => {
      vi.mocked(
        reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
      ).mockResolvedValue(null);
      vi.mocked(
        reviewRepository.findSimilarByUserIdAndTopicAngle,
      ).mockResolvedValue(null);

      await service.insertNewTopicsOnly(1, "session-1", [
        {
          topic: "Caching",
          angle: "write-path invalidation",
          description: "Practice invalidation strategies",
          priority: "high",
        },
      ]);

      expect(reviewRepository.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: "Caching",
          angle: "write-path invalidation",
        }),
      );
    });

    it("skips when a case-insensitive pair match exists", async () => {
      vi.mocked(
        reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
      ).mockResolvedValue(
        existingItem({
          topic: "system design",
          angle: "sharding trade-offs",
          priority: "high",
        }),
      );

      await service.insertNewTopicsOnly(1, "session-1", [
        {
          topic: "System Design",
          angle: "Sharding Trade-offs",
          description: "Updated",
          priority: "medium",
        },
      ]);

      expect(reviewRepository.upsert).not.toHaveBeenCalled();
      expect(
        reviewRepository.findSimilarByUserIdAndTopicAngle,
      ).not.toHaveBeenCalled();
    });

    it.each(["active", "learned"] as const)(
      "skips when a similar pair match exists (%s status)",
      async () => {
        vi.mocked(
          reviewRepository.findByUserIdAndTopicAngleCaseInsensitive,
        ).mockResolvedValue(null);
        vi.mocked(
          reviewRepository.findSimilarByUserIdAndTopicAngle,
        ).mockResolvedValue(
          existingItem({
            topic: "distributed systems",
            angle: "consistency models",
            priority: "medium",
          }),
        );

        await service.insertNewTopicsOnly(1, "session-1", [
          {
            topic: "Distributed System Design",
            angle: "consistency model trade-offs",
            description: "Clarify trade-offs",
            priority: "high",
          },
        ]);

        expect(
          reviewRepository.findSimilarByUserIdAndTopicAngle,
        ).toHaveBeenCalledWith(
          1,
          "Distributed System Design",
          "consistency model trade-offs",
        );
        expect(reviewRepository.upsert).not.toHaveBeenCalled();
      },
    );
  });

  describe("applyReviewSessionConfirmation", () => {
    it("accept-active applies suggested priority verbatim", async () => {
      const updated = existingItem({ id: "item-1", priority: "high" });
      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(
        updated,
      );

      const result = await service.applyReviewSessionConfirmation(1, "item-1", {
        status: "active",
        priority: "high",
      });

      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledWith(
        "item-1",
        1,
        {
          status: "active",
          priority: "high",
          learnedAt: null,
        },
      );
      expect(result).toBe(updated);
    });

    it("accept-learned sets learnedAt", async () => {
      const learnedAt = new Date("2026-07-07T12:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(learnedAt);

      const updated = existingItem({
        id: "item-1",
        status: "learned",
        learnedAt,
      });
      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(
        updated,
      );

      const result = await service.applyReviewSessionConfirmation(1, "item-1", {
        status: "learned",
      });

      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledWith(
        "item-1",
        1,
        {
          status: "learned",
          learnedAt,
        },
      );
      expect(result.status).toBe("learned");
      expect(result.learnedAt).toEqual(learnedAt);

      vi.useRealTimers();
    });

    it("override-active applies user priority verbatim without bump or clamp", async () => {
      const updated = existingItem({ id: "item-1", priority: "low" });
      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(
        updated,
      );

      await service.applyReviewSessionConfirmation(1, "item-1", {
        status: "active",
        priority: "low",
      });

      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledWith(
        "item-1",
        1,
        {
          status: "active",
          priority: "low",
          learnedAt: null,
        },
      );
      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledTimes(1);
    });

    it("override-learned ignores priority and only marks learned", async () => {
      const learnedAt = new Date("2026-07-07T12:00:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(learnedAt);

      const updated = existingItem({
        id: "item-1",
        status: "learned",
        priority: "high",
        learnedAt,
      });
      vi.mocked(reviewRepository.updateByIdAndUserId).mockResolvedValue(
        updated,
      );

      await service.applyReviewSessionConfirmation(1, "item-1", {
        status: "learned",
      });

      expect(reviewRepository.updateByIdAndUserId).toHaveBeenCalledWith(
        "item-1",
        1,
        {
          status: "learned",
          learnedAt,
        },
      );
      expect(
        vi.mocked(reviewRepository.updateByIdAndUserId).mock.calls[0]?.[2],
      ).not.toHaveProperty("priority");

      vi.useRealTimers();
    });
  });
});
