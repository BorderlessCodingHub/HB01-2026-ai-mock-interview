"use client";

import { useConfirmDialog } from "@/components/providers/confirm-dialog-provider";
import { AppCard } from "@/components/app/app-card";
import { ReviewPriorityBadge } from "@/features/study/review-priority-badge";
import { WeakAnswerEvaluationBadge } from "@/features/study/weak-answer-evaluation-badge";
import type { WeakAnswer } from "@/types/weak-answers";

type WeakAnswerCardProps = {
  item: WeakAnswer;
  onDelete?: () => void;
};

export function WeakAnswerCard({ item, onDelete }: WeakAnswerCardProps) {
  const confirmDialog = useConfirmDialog();

  async function handleDelete() {
    const confirmed = await confirmDialog({
      title: "Delete this answer?",
      description: `Delete this weak answer from "${item.topic}"? This cannot be undone.`,
    });
    if (confirmed) onDelete?.();
  }

  return (
    <AppCard as="li" className="space-y-4 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <ReviewPriorityBadge priority={item.priority} />
        <WeakAnswerEvaluationBadge evaluation={item.evaluation} />
        <span className="text-xs font-medium text-text-base">{item.topic}</span>
      </div>

      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-semibold tracking-wide text-text-base uppercase">
            Question
          </p>
          <p className="mt-1 leading-relaxed text-ink-black">{item.question}</p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-text-base uppercase">
            Your answer
          </p>
          <p className="mt-1 leading-relaxed text-text-base">
            {item.userAnswer}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-text-base uppercase">
            Feedback
          </p>
          <p className="mt-1 leading-relaxed text-text-base">{item.feedback}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleDelete}
          className="min-h-11 cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Delete
        </button>
      </div>
    </AppCard>
  );
}
