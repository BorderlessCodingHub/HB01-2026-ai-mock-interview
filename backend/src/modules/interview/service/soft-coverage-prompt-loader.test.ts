import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ACTIVE_REVIEW_PROMPT_LIMIT,
  TOPIC_COVERAGE_PROMPT_LIMIT,
} from "@/modules/interview/constants/topic-coverage";
import type { TopicCoverageRepository } from "@/modules/interview/repository/topic-coverage-repository";
import type { ReviewRepository } from "@/modules/interview/repository/review-repository";
import type { ReviewItemRecord } from "@/modules/interview/types/review-item-record";
import type { TopicCoverageRecord } from "@/modules/interview/types/topic-coverage-record";

import { SoftCoveragePromptLoader } from "./soft-coverage-prompt-loader";

const baseDate = new Date("2026-01-01T00:00:00.000Z");

function createCoverage(
  overrides: Partial<Pick<TopicCoverageRecord, "topic" | "angle" | "createdAt">> = {},
): TopicCoverageRecord {
  return {
    id: "coverage-id",
    userId: 1,
    sessionId: "session-id",
    topic: overrides.topic ?? "topic",
    angle: overrides.angle ?? "angle",
    createdAt: overrides.createdAt ?? baseDate,
  };
}

function createReviewItem(
  overrides: Partial<
    Pick<
      ReviewItemRecord,
      "id" | "topic" | "description" | "priority" | "status" | "updatedAt"
    >
  > = {},
): ReviewItemRecord {
  return {
    id: overrides.id ?? "review-id",
    userId: 1,
    sessionId: "session-id",
    topic: overrides.topic ?? "topic",
    description: overrides.description ?? "description",
    priority: overrides.priority ?? "medium",
    status: overrides.status ?? "active",
    learnedAt: null,
    createdAt: baseDate,
    updatedAt: overrides.updatedAt ?? baseDate,
  };
}

describe("SoftCoveragePromptLoader", () => {
  let topicCoverageRepository: TopicCoverageRepository;
  let reviewRepository: ReviewRepository;
  let loader: SoftCoveragePromptLoader;

  beforeEach(() => {
    topicCoverageRepository = {
      listRecentByUserId: vi.fn(),
    } as unknown as TopicCoverageRepository;

    reviewRepository = {
      listByUserId: vi.fn(),
    } as unknown as ReviewRepository;

    loader = new SoftCoveragePromptLoader(
      topicCoverageRepository,
      reviewRepository,
    );
  });

  it("loads recent coverage with TOPIC_COVERAGE_PROMPT_LIMIT", async () => {
    const coverageRows = [
      createCoverage({
        topic: "react",
        angle: "hooks",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      createCoverage({
        topic: "node",
        angle: "streams",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
    ];
    vi.mocked(topicCoverageRepository.listRecentByUserId).mockResolvedValue(
      coverageRows,
    );
    vi.mocked(reviewRepository.listByUserId).mockResolvedValue([]);

    const result = await loader.loadSoftCoverageHints(1);

    expect(topicCoverageRepository.listRecentByUserId).toHaveBeenCalledWith(
      1,
      TOPIC_COVERAGE_PROMPT_LIMIT,
    );
    expect(result.coverage).toEqual([
      {
        topic: "react",
        angle: "hooks",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      {
        topic: "node",
        angle: "streams",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ]);
  });

  it("excludes learned review items from active reviews", async () => {
    vi.mocked(topicCoverageRepository.listRecentByUserId).mockResolvedValue([]);
    vi.mocked(reviewRepository.listByUserId).mockResolvedValue([
      createReviewItem({
        id: "active-item",
        topic: "active topic",
        priority: "high",
      }),
      createReviewItem({
        id: "learned-item",
        topic: "learned topic",
        priority: "high",
        status: "learned",
      }),
    ]);

    const result = await loader.loadSoftCoverageHints(1);

    expect(result.activeReviews).toEqual([
      {
        topic: "active topic",
        priority: "high",
        description: "description",
      },
    ]);
  });

  it("sorts active reviews by priority then updatedAt desc", async () => {
    vi.mocked(topicCoverageRepository.listRecentByUserId).mockResolvedValue([]);
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
    ]);

    const result = await loader.loadSoftCoverageHints(1);

    expect(result.activeReviews.map((item) => item.topic)).toEqual([
      "high topic",
      "high older",
      "medium topic",
      "low topic",
    ]);
  });

  it("caps active reviews at ACTIVE_REVIEW_PROMPT_LIMIT", async () => {
    vi.mocked(topicCoverageRepository.listRecentByUserId).mockResolvedValue([]);
    const activeItems = Array.from({ length: 10 }, (_, index) =>
      createReviewItem({
        id: `item-${index}`,
        topic: `topic-${index}`,
        priority: "high",
        updatedAt: new Date(`2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
      }),
    );
    vi.mocked(reviewRepository.listByUserId).mockResolvedValue(activeItems);

    const result = await loader.loadSoftCoverageHints(1);

    expect(result.activeReviews).toHaveLength(ACTIVE_REVIEW_PROMPT_LIMIT);
    expect(result.activeReviews.map((item) => item.topic)).toEqual([
      "topic-9",
      "topic-8",
      "topic-7",
      "topic-6",
      "topic-5",
      "topic-4",
      "topic-3",
      "topic-2",
    ]);
  });
});
