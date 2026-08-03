"use client";

import { useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ReviewPriorityBadge } from "@/features/study/review-priority-badge";
import { formatTopicAngleLabel } from "@/features/study/lib/format-topic-angle";
import { cn } from "@/lib/utils";
import type { ReviewItem } from "@/types/review-items";
import { AppCard } from "@/components/app/app-card";

type StudyItemCardProps = {
  item: ReviewItem;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: () => void;
  onMarkLearned?: () => void;
  onReactivate?: () => void;
  onDelete?: () => void;
};

export function StudyItemCard({
  item,
  selectable = false,
  selected = false,
  onSelectToggle,
  onMarkLearned,
  onReactivate,
  onDelete,
}: StudyItemCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isActive = item.status === "active";
  const topicAngleLabel = formatTopicAngleLabel(item.topic, item.angle);

  const handleConfirmDelete = () => {
    onDelete?.();
    setDeleteOpen(false);
  };

  return (
    <AppCard
      as="li"
      className={cn(
        "space-y-3 p-5",
        selectable && selected && "ring-2 ring-jade ring-offset-2",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {selectable && (
            <input
              type="checkbox"
              checked={selected}
              onChange={onSelectToggle}
              className="mt-1 h-4 w-4 cursor-pointer accent-jade focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
              aria-label={`Select ${topicAngleLabel}`}
            />
          )}
          <div className="space-y-2">
            <ReviewPriorityBadge priority={item.priority} />
            <div>
              <h2 className="font-semibold text-ink-black">{topicAngleLabel}</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-base">
                {item.description}
              </p>
              {!isActive && item.learnedAt && (
                <p className="mt-2 text-xs text-text-base">
                  Learned on{" "}
                  {new Date(item.learnedAt).toLocaleDateString(undefined, {
                    dateStyle: "medium",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {isActive ? (
          <>
            <button
              type="button"
              onClick={onMarkLearned}
              className="min-h-11 cursor-pointer rounded-full border border-border-hairline px-3 py-1.5 text-xs font-medium text-ink-black transition-colors hover:bg-mist-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              Mark as learned
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="min-h-11 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onReactivate}
              className="min-h-11 cursor-pointer rounded-full border border-border-hairline px-3 py-1.5 text-xs font-medium text-ink-black transition-colors hover:bg-mist-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              Reactivate
            </button>
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="min-h-11 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
            >
              Delete
            </button>
          </>
        )}
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete review item?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{topicAngleLabel}&rdquo; from your study backlog? This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppCard>
  );
}
