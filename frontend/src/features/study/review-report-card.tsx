"use client";

import { AlertCircle } from "lucide-react";

import { ReviewPriorityBadge } from "@/features/study/review-priority-badge";
import { cn } from "@/lib/utils";
import type { InterviewLocale } from "@/types/interview";
import type { ReviewPriority } from "@/types/review-items";
import { AppCard } from "@/components/app/app-card";

import type {
  ReportCardState,
  ReportCardStatePatch,
} from "./lib/report-card-state";
import { ReviewTopicRecap } from "./review-topic-recap";

const PRIORITY_OPTIONS: ReviewPriority[] = ["low", "medium", "high"];

type ReviewReportCardProps = {
  card: ReportCardState;
  locale?: InterviewLocale;
  onChange: (patch: ReportCardStatePatch) => void;
};

function formatSuggestedCopy(card: ReportCardState): string {
  if (card.evaluationFailed) {
    return "Evaluation unavailable — choose an outcome below";
  }

  if (card.suggestedStatus === "learned") {
    return "Suggested: mark as learned";
  }

  if (card.suggestedPriority) {
    return `Suggested: ${card.suggestedPriority} priority`;
  }

  return "No suggestion";
}

export function ReviewReportCard({
  card,
  locale = "en",
  onChange,
}: ReviewReportCardProps) {
  const isActive = card.status === "active";

  return (
    <AppCard as="li" className="space-y-4 p-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-ink-black">{card.topic}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-text-base">
          <span>Current:</span>
          <ReviewPriorityBadge priority={card.currentPriority} />
        </div>

        <ReviewTopicRecap
          evaluationFailed={card.evaluationFailed}
          wentWell={card.wentWell}
          workOn={card.workOn}
          locale={locale}
        />

        {card.evaluationFailed ? (
          <div className="flex items-start gap-2 rounded-lg border border-border-hairline bg-(--status-critical-surface) px-3 py-2 text-xs text-text-base">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--status-critical-foreground)" />
            <span>{formatSuggestedCopy(card)}</span>
          </div>
        ) : (
          <p className="text-xs text-text-base">{formatSuggestedCopy(card)}</p>
        )}
      </div>

      <div className="space-y-3">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-base">
            Review outcome
          </legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onChange({ status: "active" })}
              aria-pressed={isActive}
              className={cn(
                "min-h-11 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                isActive
                  ? "border-jade-deep bg-jade-deep text-white"
                  : "border-border-hairline text-ink-black hover:bg-mist-gray",
              )}
            >
              Keep active
            </button>
            <button
              type="button"
              onClick={() => onChange({ status: "learned" })}
              aria-pressed={!isActive}
              className={cn(
                "min-h-11 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                !isActive
                  ? "border-jade-deep bg-jade-deep text-white"
                  : "border-border-hairline text-ink-black hover:bg-mist-gray",
              )}
            >
              Mark as learned
            </button>
          </div>
        </fieldset>

        {isActive && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-text-base">Priority</span>
            <select
              value={card.priority ?? card.currentPriority}
              onChange={(event) =>
                onChange({ priority: event.target.value as ReviewPriority })
              }
              className="w-full max-w-xs cursor-pointer rounded-2xl border border-border-hairline bg-paper-white px-3 py-2 text-sm text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              {PRIORITY_OPTIONS.map((priority) => (
                <option key={priority} value={priority}>
                  {priority.charAt(0).toUpperCase() + priority.slice(1)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </AppCard>
  );
}
