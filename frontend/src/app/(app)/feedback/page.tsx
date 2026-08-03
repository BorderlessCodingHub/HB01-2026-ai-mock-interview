"use client";

import { useState, type MouseEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  Trash2,
  MessageSquare,
  Loader2,
  AlertCircle,
  BookOpen,
} from "lucide-react";

import { AppShell } from "@/features/dashboard/app-shell";
import { useDeleteSession } from "@/lib/query/hooks/use-delete-session";
import { useSessions } from "@/lib/query/hooks/use-sessions";
import { useResumes } from "@/lib/query/hooks/use-resumes";
import { useSessionMessages } from "@/lib/query/hooks/use-session-messages";
import { useReviewItems } from "@/lib/query/hooks/use-review-items";
import { ReviewItemsGrid } from "@/features/dashboard/review-items-grid";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { SessionMessage } from "@/types/interview";
import { AppCard } from "@/components/app/app-card";
import { AppEmptyState } from "@/components/app/app-empty-state";
import { AppPageHeader } from "@/components/app/app-page-header";
import Link from "next/link";

function getClosingFeedback(messages: SessionMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "ai") {
      return messages[i].content;
    }
  }
  return null;
}

function SessionFeedbackDetail({
  sessionId,
  resumeName,
}: {
  sessionId: string;
  resumeName: string;
}) {
  const messagesQuery = useSessionMessages(sessionId);
  const reviewQuery = useReviewItems();

  const messages = messagesQuery.data?.messages ?? [];
  const closingFeedback = getClosingFeedback(messages);

  const sessionItems =
    reviewQuery.data?.reviewItems.filter(
      (item) => item.sessionId === sessionId,
    ) ?? [];

  if (messagesQuery.isLoading) {
    return (
      <div
        className="flex h-full items-center justify-center gap-2 py-12 text-sm text-text-base"
        role="status"
      >
        <Loader2 className="h-5 w-5 animate-spin text-jade-deep" />
        Loading feedback details…
      </div>
    );
  }

  if (messagesQuery.error) {
    const message =
      messagesQuery.error instanceof ApiError
        ? messagesQuery.error.message
        : messagesQuery.error instanceof Error
          ? messagesQuery.error.message
          : "Failed to load feedback details";

    return (
      <div className="h-full overflow-y-auto space-y-6 p-6">
        <AppPageHeader
          headingLevel={2}
          title="Feedback details"
          description={`Source CV: ${resumeName}`}
        />
        <AppCard variant="mist" className="p-6">
          <p
            className="text-sm text-(--status-critical-foreground)"
            role="alert"
          >
            {message}
          </p>
        </AppCard>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <AppPageHeader
        headingLevel={2}
        title="Feedback details"
        description={`Source CV: ${resumeName}`}
      />

      {closingFeedback ? (
        <div className="space-y-2 border-t border-border-hairline pt-4">
          <h3 className="text-sm font-semibold text-ink-black">
            General Feedback
          </h3>
          <AppCard
            variant="mist"
            className="prose prose-sm max-w-none space-y-2.5 px-5 py-4 text-sm leading-relaxed text-text-base [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4"
          >
            <ReactMarkdown>{closingFeedback}</ReactMarkdown>
          </AppCard>
        </div>
      ) : (
        <AppEmptyState
          compact
          headingLevel={3}
          title="No general feedback found"
        />
      )}

      <div className="space-y-3 border-t border-border-hairline pt-4">
        <h3 className="text-sm font-semibold text-ink-black">
          Study Topics Generated
        </h3>
        {reviewQuery.isLoading && (
          <p className="text-xs text-text-base" role="status">
            Loading topics…
          </p>
        )}
        {!reviewQuery.isLoading && reviewQuery.error && (
          <p
            className="text-sm text-(--status-critical-foreground)"
            role="alert"
          >
            {reviewQuery.error instanceof Error
              ? reviewQuery.error.message
              : "Failed to load study topics"}
          </p>
        )}
        {!reviewQuery.isLoading &&
          !reviewQuery.error &&
          sessionItems.length === 0 && (
            <AppEmptyState
              compact
              headingLevel={3}
              title="No study topics generated"
            />
          )}
        {!reviewQuery.isLoading &&
          !reviewQuery.error &&
          sessionItems.length > 0 && <ReviewItemsGrid items={sessionItems} />}
      </div>
    </div>
  );
}

function FeedbackContent() {
  const deleteSession = useDeleteSession();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const {
    data: sessionsData,
    isLoading: isLoadingSessions,
    error: sessionsError,
  } = useSessions();
  const sessions = sessionsData?.sessions ?? [];
  const finishedSessions = sessions.filter((s) => s.isFinished);
  const resolvedSessionId =
    selectedSessionId ?? finishedSessions[0]?.id ?? null;

  const { data: resumesData, error: resumesError } = useResumes();
  const resumes = resumesData?.resumes ?? [];

  const deletingId = deleteSession.isPending
    ? (deleteSession.variables ?? null)
    : null;

  function handleDeleteSession(id: string, e: MouseEvent) {
    e.stopPropagation(); // Stop click from selecting
    if (deleteSession.isPending) return;
    if (
      !confirm(
        "Are you sure you want to delete this interview feedback and all its review topics?",
      )
    ) {
      return;
    }

    const previousSelectedId = selectedSessionId;
    if (resolvedSessionId === id) {
      setSelectedSessionId(null);
    }

    deleteSession.mutate(id, {
      onError: () => {
        if (resolvedSessionId === id) {
          setSelectedSessionId(previousSelectedId);
        }
      },
    });
  }

  const selectedSession = finishedSessions.find(
    (s) => s.id === resolvedSessionId,
  );
  const selectedResume = selectedSession
    ? resumes.find((r) => r.id === selectedSession.resumeId)
    : null;
  const selectedResumeName = selectedResume ? selectedResume.name : "Resume";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden md:flex-row">
      {/* Sidebar List */}
      <aside className="flex max-h-[42%] w-full shrink-0 flex-col overflow-hidden border-b border-border-hairline bg-fog-white md:h-full md:max-h-none md:w-80 md:border-r md:border-b-0">
        <div className="flex items-center gap-2 border-b border-border-hairline p-4 text-ink-black">
          <BookOpen className="h-5 w-5" />
          <h1 className="text-sm font-semibold">Feedback</h1>
        </div>

        <div className="flex-1 divide-y divide-border-hairline overflow-y-auto">
          {resumesError && !isLoadingSessions && !sessionsError && (
            <p
              className="px-4 py-3 text-xs text-(--status-critical-foreground)"
              role="alert"
            >
              {resumesError instanceof Error
                ? resumesError.message
                : "Failed to load CV names"}
            </p>
          )}
          {isLoadingSessions ? (
            <div
              className="flex items-center justify-center gap-2 py-12 text-xs text-text-base"
              role="status"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading feedbacks…
            </div>
          ) : sessionsError ? (
            <p
              className="px-4 py-8 text-center text-sm text-(--status-critical-foreground)"
              role="alert"
            >
              {sessionsError instanceof Error
                ? sessionsError.message
                : "Failed to load feedback reports"}
            </p>
          ) : finishedSessions.length === 0 ? (
            <AppEmptyState
              compact
              headingLevel={2}
              icon={<AlertCircle className="h-5 w-5" />}
              title="No feedback yet"
              description="Complete an interview to see its feedback here."
              action={
                <Link
                  href="/practice"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-jade-deep px-3 py-1.5 text-xs font-semibold text-white hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                >
                  Go practice
                </Link>
              }
            />
          ) : (
            finishedSessions.map((sess) => {
              const isActive = resolvedSessionId === sess.id;
              const resumeObj = resumes.find((r) => r.id === sess.resumeId);
              const resumeName = resumeObj ? resumeObj.name : "Resume";

              return (
                <div
                  key={sess.id}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 p-2 transition-colors hover:bg-mist-gray",
                    isActive && "bg-jade-pale",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedSessionId(sess.id)}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col gap-1 rounded-xl p-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
                  >
                    <span className="truncate text-xs font-semibold text-ink-black">
                      {resumeName}
                    </span>
                    <span className="flex items-center gap-2 text-[10px] text-text-base">
                      <span className="font-semibold capitalize text-text-base">
                        {sess.level}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(sess.createdAt).toLocaleDateString()}
                      </span>
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={deletingId === sess.id}
                    onClick={(e) => handleDeleteSession(sess.id, e)}
                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border-hairline text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
                    aria-label={`Delete feedback for ${resumeName}`}
                    title="Delete feedback"
                  >
                    {deletingId === sess.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Detail Pane */}
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-paper-white">
        {sessionsError ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-(--status-critical-foreground)">
              Feedback details are unavailable because reports could not be
              loaded.
            </p>
          </div>
        ) : resolvedSessionId ? (
          <SessionFeedbackDetail
            sessionId={resolvedSessionId}
            resumeName={selectedResumeName}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-paper-white p-8">
            <AppEmptyState
              icon={<MessageSquare className="h-6 w-6" />}
              title="Select a feedback report"
              description="Choose a completed interview evaluation to review its details and generated topics."
            />
          </div>
        )}
      </section>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <AppShell noPadding={true}>
      <FeedbackContent />
    </AppShell>
  );
}
