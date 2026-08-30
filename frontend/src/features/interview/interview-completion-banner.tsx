import { CheckCircle2 } from "lucide-react";

import { InterviewFeedbackWidget } from "./interview-feedback-widget";

type InterviewCompletionBannerProps = {
  sessionId: string;
  onViewReview?: () => void;
};

export function InterviewCompletionBanner({
  sessionId,
  onViewReview,
}: InterviewCompletionBannerProps) {
  return (
    <div className="flex items-start gap-2 rounded-2xl bg-jade-pale px-3 py-2">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-jade-deep" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-sm font-medium text-ink-black">
            Interview completed
          </p>
          {onViewReview && (
            <button
              type="button"
              onClick={onViewReview}
              className="cursor-pointer rounded-sm text-xs font-semibold text-jade-deep underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              Jump to review
            </button>
          )}
        </div>
        <p className="mt-0.5 hidden text-xs leading-4 text-text-base sm:block">
          Closing feedback is below. Study topics appear in Review when ready.
        </p>
        <InterviewFeedbackWidget sessionId={sessionId} />
      </div>
    </div>
  );
}
