import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { ReviewPriorityBadge } from "@/features/study/review-priority-badge";
import { formatTopicAngleLabel } from "@/features/study/lib/format-topic-angle";
import type { ReviewItem } from "@/types/review-items";
import { AppCard } from "@/components/app/app-card";
import { AppEmptyState } from "@/components/app/app-empty-state";

export function ReviewItemsGrid({
  items,
  limit,
}: {
  items: ReviewItem[];
  limit?: number;
}) {
  const visible = limit ? items.slice(0, limit) : items;

  if (visible.length === 0) {
    return (
      <AppCard>
        <AppEmptyState
          headingLevel={3}
          title="Your review backlog is clear"
          description="Complete an interview to reveal topics worth revisiting."
          action={
            <Link
              href="/practice"
              className="manrope inline-flex h-10 items-center justify-center rounded-full border border-jade-deep bg-jade-deep px-4 text-sm font-medium text-paper-white transition-colors hover:border-ink-black hover:bg-ink-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-deep"
            >
              Start practice
            </Link>
          }
        />
      </AppCard>
    );
  }

  return (
    <ul className="grid list-none gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visible.map((item) => {
        return (
          <li
            key={item.id}
            className="landing-artifact flex min-w-0 flex-col p-5!"
          >
            <div className="pb-3">
              <ReviewPriorityBadge priority={item.priority} />
            </div>
            <div className="border-t border-border-hairline pt-3">
              <p className="manrope font-medium text-ink-black">
                {formatTopicAngleLabel(item.topic, item.angle)}
              </p>
              <p className="manrope mt-1 text-xs leading-relaxed text-text-base">
                {item.description}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ReviewItemsSectionHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="landing-tag mb-1 text-text-base!">Feedback</p>
        <h2 className="instrument-serif text-2xl leading-tight text-ink-black">
          Review backlog
        </h2>
        <p className="manrope mt-1 text-xs text-text-base">
          Topics identified after your mock interviews.
        </p>
      </div>
      <Link
        href="/feedback"
        className="manrope flex items-center gap-1.5 text-sm font-medium text-jade-deep underline-offset-4 transition-colors hover:text-ink-black hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-deep"
      >
        View all
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
