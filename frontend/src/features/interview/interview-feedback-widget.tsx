"use client";

import { useState, useSyncExternalStore } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { interviewApi } from "@/lib/api/interview";
import { queryKeys } from "@/lib/query/keys";
import { cn } from "@/lib/utils";
import type {
  FeedbackRating,
  ListSessionsResponse,
  SessionFeedbackSummary,
  SessionSummary,
} from "@/types/interview";

import {
  dismissFeedbackPrompt,
  getFeedbackWidgetView,
  isFeedbackPromptDismissed,
  subscribeFeedbackPromptDismissal,
} from "./lib/feedback-prompt";
import { getErrorMessage } from "@/components/app/app-error-state";

const MAX_COMMENT_LENGTH = 1000;

type InterviewFeedbackWidgetProps = {
  sessionId: string;
  /**
   * The user's saved rating, from the session detail/list endpoints. This is
   * the source of truth for "already rated", so the prompt does not come back
   * after a reload, on another page visit or on another device. Callers should
   * key the widget on it (e.g. `feedback?.updatedAt`) so the form resets when
   * the saved rating changes.
   */
  feedback: SessionFeedbackSummary | null | undefined;
};

/** Mirror a saved rating into the cached session detail and list. */
function cacheSessionFeedback(
  queryClient: QueryClient,
  sessionId: string,
  feedback: SessionFeedbackSummary,
) {
  queryClient.setQueryData<SessionSummary>(
    queryKeys.session(sessionId),
    (old) => (old ? { ...old, feedback } : old),
  );
  queryClient.setQueryData<ListSessionsResponse>(queryKeys.sessions, (old) =>
    old
      ? {
          ...old,
          sessions: old.sessions.map((s) =>
            s.id === sessionId ? { ...s, feedback } : s,
          ),
        }
      : old,
  );
}

function useFeedbackPromptDismissed(sessionId: string): boolean {
  return useSyncExternalStore(
    subscribeFeedbackPromptDismissal,
    () => isFeedbackPromptDismissed(sessionId),
    () => false,
  );
}

export function InterviewFeedbackWidget({
  sessionId,
  feedback,
}: InterviewFeedbackWidgetProps) {
  const { getAccessToken } = useAuth();
  const queryClient = useQueryClient();
  const dismissed = useFeedbackPromptDismissed(sessionId);
  const [comment, setComment] = useState(feedback?.comment ?? "");
  const [selectedRating, setSelectedRating] = useState<FeedbackRating | null>(
    feedback?.rating ?? null,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isRated = feedback != null;
  const view = getFeedbackWidgetView({
    feedback,
    dismissed,
    isEditing: isEditing || isSubmitting,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || selectedRating === null) return;

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    setIsSubmitting(true);

    try {
      const saved = await interviewApi.submitFeedback(
        sessionId,
        { rating: selectedRating, comment: comment.trim() },
        token,
      );
      setIsEditing(false);
      cacheSessionFeedback(queryClient, sessionId, {
        rating: saved.rating,
        comment: saved.comment,
        updatedAt: saved.updatedAt,
      });
    } catch (err) {
      toast.error(
        getErrorMessage(err, "Failed to submit feedback"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    if (isRated) {
      setSelectedRating(feedback.rating);
      setComment(feedback.comment ?? "");
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    dismissFeedbackPrompt(sessionId);
  }

  if (view === "rated" && feedback) {
    return (
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-jade/20 pt-2">
        <p className="text-xs text-jade-deep" role="status">
          Thanks for your feedback! You rated this interview{" "}
          {feedback.rating === "up" ? "helpful" : "not helpful"}.
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

  if (view === "dismissed") {
    return (
      <div className="mt-2 border-t border-jade/20 pt-1">
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="min-h-11 cursor-pointer rounded-sm text-xs font-semibold text-jade-deep underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Rate this interview
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-2 space-y-2 border-t border-jade/20 pt-2"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink-black">
          Was this interview helpful?
        </p>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          aria-label={isRated ? "Cancel editing feedback" : "Not now"}
          className="-my-2 flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full text-text-base transition-colors hover:text-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

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
          className="w-full resize-none rounded-2xl border border-border-hairline bg-paper-white px-3 py-2 text-base text-ink-black md:text-sm placeholder:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:opacity-50"
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
        ) : isRated ? (
          "Update feedback"
        ) : (
          "Submit feedback"
        )}
      </button>
    </form>
  );
}
