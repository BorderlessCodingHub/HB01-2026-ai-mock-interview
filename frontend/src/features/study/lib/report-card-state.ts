import type { ReviewItemStatus, ReviewPriority } from "@/types/review-items";
import type { ReviewSessionItemReport } from "@/types/review-sessions";

import { formatTopicAngleLabel } from "./format-topic-angle";

export type ReportCardState = {
  reviewSessionItemId: string;
  topic: string;
  currentPriority: ReviewPriority;
  suggestedStatus: ReviewItemStatus | null;
  suggestedPriority: ReviewPriority | null;
  evaluationFailed: boolean;
  status: ReviewItemStatus;
  priority: ReviewPriority | null;
};

export type ReportCardStatePatch = Partial<
  Pick<ReportCardState, "status" | "priority">
>;

export function initReportCardState(
  item: ReviewSessionItemReport,
): ReportCardState {
  const topicLabel = formatTopicAngleLabel(item.topic, item.angle);

  if (item.suggestedStatus === null) {
    return {
      reviewSessionItemId: item.id,
      topic: topicLabel,
      currentPriority: item.currentPriority,
      suggestedStatus: item.suggestedStatus,
      suggestedPriority: item.suggestedPriority,
      evaluationFailed: true,
      status: "active",
      priority: item.currentPriority,
    };
  }

  const status = item.suggestedStatus;
  const priority =
    status === "learned"
      ? null
      : (item.suggestedPriority ?? item.currentPriority);

  return {
    reviewSessionItemId: item.id,
    topic: topicLabel,
    currentPriority: item.currentPriority,
    suggestedStatus: item.suggestedStatus,
    suggestedPriority: item.suggestedPriority,
    evaluationFailed: false,
    status,
    priority,
  };
}

export function updateReportCardState(
  card: ReportCardState,
  patch: ReportCardStatePatch,
): ReportCardState {
  if (patch.status === "learned") {
    return { ...card, status: "learned", priority: null };
  }

  if (patch.status === "active") {
    const priority =
      patch.priority ??
      card.priority ??
      card.suggestedPriority ??
      card.currentPriority;
    return { ...card, status: "active", priority };
  }

  if (patch.priority !== undefined) {
    if (card.status === "learned") {
      return card;
    }
    return { ...card, priority: patch.priority };
  }

  return card;
}
