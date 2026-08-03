import { cn } from "@/lib/utils";
import type { AnswerEvaluation } from "@/types/weak-answers";

const EVALUATION_STYLES: Record<
  AnswerEvaluation,
  { badge: string; label: string }
> = {
  incorrect: {
    badge: "bg-red-100 text-red-700",
    label: "Incorrect",
  },
  incomplete: {
    badge: "bg-amber-100 text-amber-700",
    label: "Incomplete",
  },
  insufficient: {
    badge: "bg-jade-pale text-jade-deep",
    label: "Insufficient",
  },
  satisfactory: {
    badge: "bg-mist-gray text-text-base",
    label: "Satisfactory",
  },
};

type WeakAnswerEvaluationBadgeProps = {
  evaluation: AnswerEvaluation;
  className?: string;
};

export function WeakAnswerEvaluationBadge({
  evaluation,
  className,
}: WeakAnswerEvaluationBadgeProps) {
  const styles = EVALUATION_STYLES[evaluation];

  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold",
        styles.badge,
        className,
      )}
    >
      {styles.label}
    </span>
  );
}
