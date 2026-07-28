import type { ReviewSessionItemReport } from "@/types/review-sessions";

import type { ReviewDisplayMessage } from "./review-display-messages";

type TurnsSourceItem = Pick<ReviewSessionItemReport, "id" | "topic" | "turns">;

/**
 * Maps completed session items + turns into display messages with stable ids
 * (SSR/hydration safe — no crypto.randomUUID).
 */
export function turnsToDisplayMessages(
  items: TurnsSourceItem[],
): ReviewDisplayMessage[] {
  const messages: ReviewDisplayMessage[] = [];

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex]!;

    messages.push({
      id: `${item.id}-topic`,
      kind: "topic",
      topic: item.topic,
      itemIndex,
    });

    for (let i = 0; i < item.turns.length; i++) {
      const turn = item.turns[i]!;

      messages.push({
        id: `${item.id}-t${i}-q`,
        kind: "ai",
        content: turn.question,
        createdAt: "",
      });

      messages.push({
        id: `${item.id}-t${i}-a`,
        kind: "human",
        content: turn.answer,
        createdAt: "",
      });
    }
  }

  return messages;
}
