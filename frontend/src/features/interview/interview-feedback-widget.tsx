"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { ApiError } from "@/lib/api/client";
import { interviewApi } from "@/lib/api/interview";
import { cn } from "@/lib/utils";
import type { FeedbackRating } from "@/types/interview";

const MAX_COMMENT_LENGTH = 1000;

type InterviewFeedbackWidgetProps = {
  sessionId: string;
};

export function InterviewFeedbackWidget({
  sessionId,
}: InterviewFeedbackWidgetProps) {
  const { getAccessToken } = useAuth();
  const [comment, setComment] = useState("");
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(
    null,
  );
  const [submitted, setSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const showForm = !submitted || isEditing || isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || selectedRating === null) return;

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const previousSubmitted = submitted;
    setSubmitted(true);
    setIsSubmitting(true);

    try {
      const trimmedComment = comment.trim();
      await interviewApi.submitFeedback(
        sessionId,
        { rating: selectedRating, comment: trimmedComment },
        token,
      );
      setIsEditing(false);
    } catch (err) {
      setSubmitted(previousSubmitted);
      toast.error(
        err instanceof ApiError ? err.message : "Failed to submit feedback",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!showForm) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-jade/20 pt-2">
        <p className="text-xs text-jade-deep" role="status">
          Thanks for your feedback!
        </p>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="min-h-11 cursor-pointer rounded-sm text-xs font-semibold text-jade-deep underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-2 space-y-2 border-t border-jade/20 pt-2"
    >
      <p className="text-xs font-medium text-ink-black">
        Was this interview helpful?
      </p>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSelectedRating("up")}
          disabled={isSubmitting}
          aria-pressed={selectedRating === "up"}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
            selectedRating === "up"
              ? "border-jade bg-jade-mist text-jade-deep"
              : "border-border-hairline bg-paper-white text-ink-black hover:bg-mist-gray",
          )}
        >
          👍 Helpful
        </button>

        <button
          type="button"
          onClick={() => setSelectedRating("down")}
          disabled={isSubmitting}
          aria-pressed={selectedRating === "down"}
          className={cn(
            "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
            selectedRating === "down"
              ? "border-red-400 bg-red-50 text-red-800"
              : "border-border-hairline bg-paper-white text-ink-black hover:bg-mist-gray",
          )}
        >
          👎 Not helpful
        </button>
      </div>

      <div>
        <label
          htmlFor={`interview-feedback-comment-${sessionId}`}
          className="sr-only"
        >
          Optional comment
        </label>
        <textarea
          id={`interview-feedback-comment-${sessionId}`}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="Optional comment…"
          rows={1}
          disabled={isSubmitting}
          className="w-full resize-none rounded-2xl border border-border-hairline bg-paper-white px-3 py-2 text-sm text-ink-black placeholder:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:opacity-50"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting || selectedRating === null}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-jade-deep px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </>
        ) : submitted ? (
          "Update feedback"
        ) : (
          "Submit feedback"
        )}
      </button>
    </form>
  );
}
