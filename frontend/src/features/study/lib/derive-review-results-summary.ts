import type { ReviewSessionItemReport } from "@/types/review-sessions";

export type ReviewResultsSummary = {
  topicCount: number;
  learnedCount: number;
  priorityChangeCount: number;
};

export function deriveReviewResultsSummary(
  items: ReviewSessionItemReport[],
  source: "suggested" | "confirmed",
): ReviewResultsSummary {
  let learnedCount = 0;
  let priorityChangeCount = 0;

  for (const item of items) {
    const status =
      source === "suggested" ? item.suggestedStatus : item.confirmedStatus;
    const priority =
      source === "suggested" ? item.suggestedPriority : item.confirmedPriority;

    if (status === "learned") {
      learnedCount += 1;
      continue;
    }

    if (
      status === "active" &&
      priority != null &&
      priority !== item.currentPriority
    ) {
      priorityChangeCount += 1;
    }
  }

  return {
    topicCount: items.length,
    learnedCount,
    priorityChangeCount,
  };
}
