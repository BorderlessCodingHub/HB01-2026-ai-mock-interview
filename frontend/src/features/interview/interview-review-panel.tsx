"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Loader2 } from "lucide-react";

import { ReviewItemsGrid } from "@/features/dashboard/review-items-grid";
import { useReviewItems } from "@/lib/query/hooks/use-review-items";
import type { ReviewGenerationStatus, SessionMessage } from "@/types/interview";
import { AppCard } from "@/components/app/app-card";

type InterviewReviewPanelProps = {
  sessionId: string;
  messages: SessionMessage[];
  reviewGenerationStatus?: ReviewGenerationStatus;
  reviewGenerationError?: string | null;
  onRetryReviewGeneration?: () => void | Promise<void>;
  isRetrying?: boolean;
};

function getClosingFeedback(messages: SessionMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "ai") {
      return messages[i].content;
    }
  }
  return null;
}

export function InterviewReviewPanel({
  sessionId,
  messages,
  reviewGenerationStatus,
  reviewGenerationError,
  onRetryReviewGeneration,
  isRetrying = false,
}: InterviewReviewPanelProps) {
  const { data, isLoading, error } = useReviewItems();
  const sessionItems =
    data?.reviewItems.filter((item) => item.sessionId === sessionId) ?? [];
  const closingFeedback = getClosingFeedback(messages);

  const status = reviewGenerationStatus ?? "idle";
  const showPreparing = status === "pending";
  const showFailed = status === "failed";
  const showGrid = status === "ready" || status === "idle";

  return (
    <AppCard as="section" id="interview-review" className="mt-6 space-y-4 p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink-black">
            Interview review
          </h2>
          <p className="text-xs text-text-base">
            Closing feedback and topics to study from this session.
          </p>
        </div>
        <Link
          href="/study"
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-jade-deep hover:bg-jade-pale focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Full backlog
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {closingFeedback && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-black">
            General feedback
          </h3>
          <div className="prose prose-sm max-w-none space-y-2 rounded-2xl bg-mist-gray px-4 py-3 text-sm leading-relaxed text-text-base [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4">
            <ReactMarkdown>{closingFeedback}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-ink-black">
          Topics to review
        </h3>
        {showPreparing && (
          <p className="text-sm text-text-base" role="status">
            Your study items are being generated. They’ll be ready in a moment.
          </p>
        )}
        {showFailed && (
          <div className="space-y-3">
            <p className="text-sm text-red-700" role="alert">
              {reviewGenerationError?.trim() ||
                "Failed to generate review topics. You can retry."}
            </p>
            {onRetryReviewGeneration && (
              <button
                type="button"
                onClick={() => void onRetryReviewGeneration()}
                disabled={isRetrying}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-border-hairline bg-paper-white px-3 py-1.5 text-xs font-medium text-ink-black transition-colors hover:bg-mist-gray disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
              >
                {isRetrying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {isRetrying ? "Retrying…" : "Retry"}
              </button>
            )}
          </div>
        )}
        {showGrid && isLoading && (
          <p className="text-sm text-text-base" role="status">
            Loading topics…
          </p>
        )}
        {showGrid && error && (
          <p className="text-sm text-red-700" role="alert">
            {error instanceof Error ? error.message : "Failed to load topics"}
          </p>
        )}
        {showGrid && !isLoading && !error && (
          <ReviewItemsGrid items={sessionItems} />
        )}
      </div>
    </AppCard>
  );
}
