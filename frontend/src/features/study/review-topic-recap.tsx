import type { InterviewLocale } from "@/types/interview";

import { getReviewRecapHeadings } from "./lib/review-recap-copy";

type ReviewTopicRecapProps = {
  locale: InterviewLocale;
  wentWell: string[];
  workOn: string[];
  evaluationFailed: boolean;
};

function RecapSection({
  heading,
  items,
}: {
  heading: string;
  items: string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <h3 className="text-xs font-semibold text-ink-black">{heading}</h3>
      <ul className="list-disc space-y-1 pl-4 text-xs text-text-base">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function ReviewTopicRecap({
  locale,
  wentWell,
  workOn,
  evaluationFailed,
}: ReviewTopicRecapProps) {
  if (evaluationFailed) {
    return null;
  }

  const headings = getReviewRecapHeadings(locale);

  if (wentWell.length === 0 && workOn.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <RecapSection heading={headings.wentWell} items={wentWell} />
      <RecapSection heading={headings.workOn} items={workOn} />
    </div>
  );
}
