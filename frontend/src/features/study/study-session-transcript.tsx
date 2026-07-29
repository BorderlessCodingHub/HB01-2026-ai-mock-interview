"use client";

import { useMemo } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import { AppEmptyState } from "@/components/app/app-empty-state";
import { InterviewMessageBubble } from "@/features/interview/interview-message-bubble";
import {
  InterviewMessageList,
  type DisplayMessage,
} from "@/features/interview/interview-message-list";
import { useReviewSession } from "@/lib/query/hooks/use-review-session";

import type { ReviewDisplayMessage } from "./lib/review-display-messages";
import { turnsToDisplayMessages } from "./lib/turns-to-display-messages";

type StudySessionTranscriptProps = {
  sessionId: string;
  onBack?: () => void;
};

function ReviewTopicDivider({ topic }: { topic: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border-hairline" />
      <span className="text-xs font-medium text-text-base">{topic}</span>
      <div className="h-px flex-1 bg-border-hairline" />
    </div>
  );
}

function toDisplayMessage(
  message: Extract<ReviewDisplayMessage, { kind: "human" | "ai" }>,
): DisplayMessage {
  return {
    id: message.id,
    role: message.kind,
    content: message.content,
    createdAt: message.createdAt,
  };
}

export function StudySessionTranscript({
  sessionId,
  onBack,
}: StudySessionTranscriptProps) {
  const sessionQuery = useReviewSession(sessionId);
  const session = sessionQuery.data;

  const displayMessages = useMemo(
    () => (session ? turnsToDisplayMessages(session.items) : []),
    [session],
  );

  const qaMessages = useMemo(
    () =>
      displayMessages.filter(
        (message): message is Extract<ReviewDisplayMessage, { kind: "human" | "ai" }> =>
          message.kind === "human" || message.kind === "ai",
      ),
    [displayMessages],
  );

  const hasTopicDividers = displayMessages.some(
    (message) => message.kind === "topic",
  );

  const chatOnlyMessages = useMemo(
    () => qaMessages.map(toDisplayMessage),
    [qaMessages],
  );

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-center gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm text-sm font-medium text-jade-deep transition-colors hover:text-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
        )}
        <h1 className="instrument-serif text-2xl leading-tight text-ink-black">
          Session transcript
        </h1>
      </div>

      {sessionQuery.isLoading && (
        <div
          className="flex items-center gap-2 py-12 text-sm text-text-base"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading transcript…
        </div>
      )}

      {sessionQuery.error && (
        <div className="space-y-3 py-6">
          <p className="text-sm text-red-700" role="alert">
            {sessionQuery.error instanceof Error
              ? sessionQuery.error.message
              : "Failed to load transcript"}
          </p>
          <button
            type="button"
            onClick={() => void sessionQuery.refetch()}
            disabled={sessionQuery.isFetching}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-jade-deep px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sessionQuery.isFetching && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            )}
            {sessionQuery.isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      )}

      {!sessionQuery.isLoading && !sessionQuery.error && session && (
        <>
          {qaMessages.length === 0 ? (
            <AppEmptyState
              title="No transcript available"
              description="This session has no stored Q&A turns."
            />
          ) : hasTopicDividers ? (
            <div className="flex-1 space-y-4 overflow-y-auto rounded-[20px] bg-paper-white p-4 shadow-(--shadow-subtle-3)">
              {displayMessages.map((message) => {
                if (message.kind === "topic") {
                  return (
                    <ReviewTopicDivider key={message.id} topic={message.topic} />
                  );
                }

                return (
                  <InterviewMessageBubble
                    key={message.id}
                    role={message.kind}
                    content={message.content}
                  />
                );
              })}
            </div>
          ) : (
            <InterviewMessageList
              messages={chatOnlyMessages}
              showWelcome={false}
            />
          )}
        </>
      )}
    </div>
  );
}
