import { CheckCircle2, ListTodo } from "lucide-react";

import { cn } from "@/lib/utils";
import type { InterviewLocale } from "@/types/interview";

import { getReviewRecapHeadings } from "./lib/review-recap-copy";

type RecapTone = "wentWell" | "workOn";

type ReviewTopicRecapProps = {
  locale: InterviewLocale;
  wentWell: string[];
  workOn: string[];
  evaluationFailed: boolean;
};

function RecapSection({
  heading,
  items,
  tone,
}: {
  heading: string;
  items: string[];
  tone: RecapTone;
}) {
  if (items.length === 0) {
    return null;
  }

  const isWentWell = tone === "wentWell";
  const Icon = isWentWell ? CheckCircle2 : ListTodo;

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon
          aria-hidden
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            isWentWell ? "text-jade-deep" : "text-slate-gray",
          )}
        />
        <h3 className="text-xs font-semibold text-ink-black">{heading}</h3>
      </div>
      <ul
        className={cn(
          "space-y-2.5 border-l-2 pl-3.5",
          isWentWell ? "border-jade-light" : "border-border-hairline",
        )}
      >
        {items.map((item, index) => (
          <li
            key={index}
            className="flex gap-2.5 text-sm leading-relaxed text-text-base"
          >
            <span
              aria-hidden
              className={cn(
                "mt-[0.55em] h-1 w-1 shrink-0 rounded-full",
                isWentWell ? "bg-jade" : "bg-ash-gray",
              )}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
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
    <div className="space-y-4">
      <RecapSection
        heading={headings.wentWell}
        items={wentWell}
        tone="wentWell"
      />
      <RecapSection heading={headings.workOn} items={workOn} tone="workOn" />
    </div>
  );
}
