import { AppCard } from "@/components/app/app-card";
import type { InterviewLocale } from "@/types/interview";
import type { ReviewSessionItemReport } from "@/types/review-sessions";

import { formatTopicAngleLabel } from "./lib/format-topic-angle";
import { ReviewPriorityBadge } from "./review-priority-badge";
import { ReviewTopicRecap } from "./review-topic-recap";

export type ReviewHistoryResultCardProps = {
  item: ReviewSessionItemReport;
  locale: InterviewLocale;
};

function AppliedOutcome({ item }: { item: ReviewSessionItemReport }) {
  if (item.confirmedStatus === null) {
    return null;
  }

  if (item.confirmedStatus === "learned") {
    return <p className="text-xs text-text-base">Marked as learned</p>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-text-base">
      <span>Kept active</span>
      {item.confirmedPriority ? (
        <ReviewPriorityBadge priority={item.confirmedPriority} />
      ) : null}
    </div>
  );
}

export function ReviewHistoryResultCard({
  item,
  locale,
}: ReviewHistoryResultCardProps) {
  return (
    <AppCard as="li" className="space-y-4 p-5">
      <h2 className="font-semibold text-ink-black">
        {formatTopicAngleLabel(item.topic, item.angle)}
      </h2>
      <ReviewTopicRecap
        locale={locale}
        wentWell={item.wentWell}
        workOn={item.workOn}
        evaluationFailed={item.suggestedStatus === null}
      />
      <AppliedOutcome item={item} />
    </AppCard>
  );
}
