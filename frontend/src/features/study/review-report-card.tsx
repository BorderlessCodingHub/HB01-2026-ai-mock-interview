"use client";

import { AlertCircle, Sparkles } from "lucide-react";

import { AppCard } from "@/components/app/app-card";
import { ReviewPriorityBadge } from "@/features/study/review-priority-badge";
import { cn } from "@/lib/utils";
import type { InterviewLocale } from "@/types/interview";
import type { ReviewPriority } from "@/types/review-items";

import type {
  ReportCardState,
  ReportCardStatePatch,
} from "./lib/report-card-state";
import { ReviewTopicRecap } from "./review-topic-recap";

const PRIORITY_OPTIONS: ReviewPriority[] = ["low", "medium", "high"];

const PRIORITY_PILL_SELECTED: Record<ReviewPriority, string> = {
  high: "border-red-200 bg-red-100 text-red-700",
  medium: "border-jade bg-jade-pale text-jade-deep",
  low: "border-border-hairline bg-mist-gray text-text-base",
};

const segmentedButtonClass =
  "min-h-11 cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2";

type ReviewReportCardProps = {
  card: ReportCardState;
  locale?: InterviewLocale;
  onChange: (patch: ReportCardStatePatch) => void;
};

function SuggestionLine({ card }: { card: ReportCardState }) {
  if (card.evaluationFailed) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-border-hairline bg-(--status-critical-surface) px-3 py-2 text-xs text-text-base">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-(--status-critical-foreground)" />
        <span>Evaluation unavailable — choose an outcome below</span>
      </div>
    );
  }

  if (card.suggestedStatus === "learned") {
    return (
      <p className="flex items-center gap-2 text-xs text-text-base">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-jade-deep" aria-hidden />
        Suggested: mark as learned
      </p>
    );
  }

  if (card.suggestedPriority) {
    return (
      <p className="flex items-center gap-2 text-xs text-text-base">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-jade-deep" aria-hidden />
        {`Suggested: ${card.suggestedPriority} priority`}
      </p>
    );
  }

  return <p className="text-xs text-text-base">No suggestion</p>;
}

export function ReviewReportCard({
  card,
  locale = "en",
  onChange,
}: ReviewReportCardProps) {
  const isActive = card.status === "active";
  const selectedPriority = card.priority ?? card.currentPriority;

  return (
    <AppCard as="li" className="overflow-hidden p-0">
      <div className="space-y-4 p-5">
        <header className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="min-w-0 flex-1 font-semibold text-ink-black">
            {card.topic}
          </h2>
          <ReviewPriorityBadge
            className="shrink-0"
            priority={card.currentPriority}
          />
        </header>

        <ReviewTopicRecap
          evaluationFailed={card.evaluationFailed}
          wentWell={card.wentWell}
          workOn={card.workOn}
          locale={locale}
        />

        <SuggestionLine card={card} />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-border-hairline px-5 py-4">
        <fieldset>
          <legend className="mb-2 text-xs font-medium text-text-base">
            Review outcome
          </legend>
          <div
            className="inline-flex rounded-full border border-border-hairline bg-mist-gray p-0.5"
            role="group"
          >
            <button
              type="button"
              onClick={() => onChange({ status: "active" })}
              aria-pressed={isActive}
              className={cn(
                segmentedButtonClass,
                isActive
                  ? "bg-paper-white text-ink-black shadow-sm"
                  : "text-text-base hover:text-ink-black",
              )}
            >
              Keep active
            </button>
            <button
              type="button"
              onClick={() => onChange({ status: "learned" })}
              aria-pressed={!isActive}
              className={cn(
                segmentedButtonClass,
                !isActive
                  ? "bg-paper-white text-ink-black shadow-sm"
                  : "text-text-base hover:text-ink-black",
              )}
            >
              Mark as learned
            </button>
          </div>
        </fieldset>

        {isActive && (
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-text-base">
              Priority
            </legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {PRIORITY_OPTIONS.map((priority) => {
                const isSelected = selectedPriority === priority;

                return (
                  <button
                    key={priority}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onChange({ priority })}
                    className={cn(
                      "min-h-11 cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                      isSelected
                        ? PRIORITY_PILL_SELECTED[priority]
                        : "border-border-hairline bg-paper-white text-ink-black hover:bg-mist-gray",
                    )}
                  >
                    {priority}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}
      </div>
    </AppCard>
  );
}
