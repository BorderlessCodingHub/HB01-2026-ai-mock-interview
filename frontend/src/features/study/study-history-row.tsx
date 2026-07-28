"use client";

import { cn } from "@/lib/utils";
import type { ReviewSessionSummary } from "@/types/review-sessions";

type StudyHistoryRowProps = {
  summary: ReviewSessionSummary;
  isActive: boolean;
  onSelect: () => void;
};

export function StudyHistoryRow({
  summary,
  isActive,
  onSelect,
}: StudyHistoryRowProps) {
  const topicsLabel = summary.topics.join(", ");
  const dateLabel = new Date(
    summary.completedAt ?? summary.createdAt,
  ).toLocaleDateString();

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full cursor-pointer flex-col gap-1 p-3.5 text-left transition-colors hover:bg-mist-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jade",
        isActive && "bg-jade-pale",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span className="line-clamp-2 flex-1 text-xs font-semibold text-ink-black">
          {topicsLabel}
        </span>
        <span className="shrink-0 rounded-full bg-(--status-neutral-surface) px-2 py-0.5 text-[10px] font-semibold text-(--status-neutral-foreground)">
          Completed
        </span>
      </div>

      <div className="flex items-center justify-end text-[10px] text-text-base">
        <span>{dateLabel}</span>
      </div>
    </button>
  );
}
