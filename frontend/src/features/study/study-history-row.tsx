"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

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
import { cn } from "@/lib/utils";
import type { ReviewSessionSummary } from "@/types/review-sessions";

type StudyHistoryRowProps = {
  summary: ReviewSessionSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

export function StudyHistoryRow({
  summary,
  isActive,
  onSelect,
  onDelete,
}: StudyHistoryRowProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const topicsLabel = summary.topics.join(", ");
  const dateLabel = new Date(
    summary.completedAt ?? summary.createdAt,
  ).toLocaleDateString();

  function handleConfirmDelete() {
    onDelete();
    setDeleteOpen(false);
  }

  return (
    <div
      className={cn(
        "group flex items-stretch transition-colors hover:bg-mist-gray",
        isActive && "bg-jade-pale",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-1 p-3.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jade"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <span className="line-clamp-2 min-w-0 flex-1 text-xs font-semibold text-ink-black">
            {topicsLabel || "Untitled session"}
          </span>
          <span className="shrink-0 rounded-full bg-(--status-neutral-surface) px-2 py-0.5 text-[10px] font-semibold text-(--status-neutral-foreground)">
            Completed
          </span>
        </div>

        <div className="flex items-center justify-end text-[10px] text-text-base">
          <span>{dateLabel}</span>
        </div>
      </button>
      <button
        type="button"
        aria-label="Delete review session"
        onClick={() => setDeleteOpen(true)}
        className="flex w-10 shrink-0 cursor-pointer items-center justify-center text-text-base transition-colors hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-jade"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this review session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this review session. This cannot
              be undone.
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
    </div>
  );
}
