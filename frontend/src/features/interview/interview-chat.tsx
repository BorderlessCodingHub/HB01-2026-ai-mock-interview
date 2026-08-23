"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { useInterviewLocale } from "@/features/interview-locale/use-interview-locale";
import { interviewApi } from "@/lib/api/interview";
import { streamInterviewTurn } from "@/lib/api/interview-stream";
import { useInterviewSession } from "@/lib/query/hooks/use-interview-session";
import { useSessionMessages } from "@/lib/query/hooks/use-session-messages";
import { useSessions } from "@/lib/query/hooks/use-sessions";
import { queryKeys } from "@/lib/query/keys";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type {
  ListMessagesResponse,
  ListSessionsResponse,
  SessionMessage,
  SessionSummary,
  StreamMeta,
} from "@/types/interview";

import { InterviewChatInput } from "./interview-chat-input";
import { InterviewCompletionBanner } from "./interview-completion-banner";
import {
  InterviewMessageList,
  type DisplayMessage,
} from "./interview-message-list";
import { toDisplayTurns } from "./lib/display-turns";
import {
  getInterviewReadyMessage,
  getInterviewWelcomeText,
} from "./interview-ready-message";
import { InterviewReviewPanel } from "./interview-review-panel";

export function InterviewChat({ sessionId }: { sessionId: string }) {
  const { getAccessToken, fetchWithAuth } = useAuth();
  const { locale } = useInterviewLocale();
  const queryClient = useQueryClient();
  const messagesQuery = useSessionMessages(sessionId);
  const sessionsQuery = useSessions();
  const sessionDetailQuery = useInterviewSession(sessionId);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingHuman, setPendingHuman] = useState<SessionMessage | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");
  const autoStartedForSessionRef = useRef<string | null>(null);
  const sendMessageRef = useRef<(content: string) => Promise<void>>(
    async () => {},
  );
  const [viewMode, setViewMode] = useState<"chat" | "review">("chat");
  const [isRetrying, setIsRetrying] = useState(false);

  const session = sessionsQuery.data?.sessions.find((s) => s.id === sessionId);
  const displayTurns =
    session != null
      ? toDisplayTurns(session.turnCount, session.maxTurns)
      : null;
  const isFinished = session?.isFinished ?? false;
  const atTurnLimit = session != null && session.turnCount >= session.maxTurns;
  const isCompleted = isFinished || atTurnLimit;
  const canSend = !isCompleted && !isStreaming;

  const reviewGenerationStatus =
    sessionDetailQuery.data?.reviewGenerationStatus ??
    session?.reviewGenerationStatus;
  const reviewGenerationError =
    sessionDetailQuery.data?.reviewGenerationError ??
    session?.reviewGenerationError ??
    null;

  const serverMessages = messagesQuery.data?.messages ?? [];
  const showWelcome =
    serverMessages.length === 0 && !isStreaming && !pendingHuman;

  const displayMessages: DisplayMessage[] = [...serverMessages];

  if (pendingHuman && !displayMessages.some((m) => m.id === pendingHuman.id)) {
    displayMessages.push(pendingHuman);
  }

  if (isStreaming) {
    if (streamingContent) {
      displayMessages.push({
        id: "streaming",
        role: "ai",
        content: streamingContent,
        createdAt: new Date().toISOString(),
        streaming: true,
      });
    } else {
      displayMessages.push({
        id: "typing",
        role: "ai",
        content: "",
        createdAt: new Date().toISOString(),
        typing: true,
      });
    }
  }

  const updateSessionMeta = useCallback(
    (meta: StreamMeta) => {
      queryClient.setQueryData<ListSessionsResponse>(
        queryKeys.sessions,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            sessions: old.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    turnCount: meta.turnCount,
                    maxTurns: meta.maxTurns,
                    isFinished: meta.isFinished,
                    ...(meta.reviewGenerationStatus != null
                      ? {
                          reviewGenerationStatus: meta.reviewGenerationStatus,
                          reviewGenerationError: null,
                        }
                      : {}),
                  }
                : s,
            ),
          };
        },
      );

      queryClient.setQueryData<SessionSummary>(
        queryKeys.session(sessionId),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            turnCount: meta.turnCount,
            maxTurns: meta.maxTurns,
            isFinished: meta.isFinished,
            ...(meta.reviewGenerationStatus != null
              ? {
                  reviewGenerationStatus: meta.reviewGenerationStatus,
                  reviewGenerationError: null,
                }
              : {}),
          };
        },
      );
    },
    [queryClient, sessionId],
  );

  const mergeStreamedMessages = useCallback(
    (humanContent: string, aiContent: string, pendingId: string) => {
      queryClient.setQueryData<ListMessagesResponse>(
        queryKeys.sessionMessages(sessionId),
        (old) => {
          const existing = old?.messages ?? [];
          const withoutCurrentPending = existing.filter(
            (m) => m.id !== pendingId,
          );

          const next: SessionMessage[] = [
            ...withoutCurrentPending,
            {
              id: pendingId,
              role: "human",
              content: humanContent,
              createdAt: new Date().toISOString(),
            },
          ];

          if (aiContent) {
            next.push({
              id: `optimistic-ai-${Date.now()}`,
              role: "ai",
              content: aiContent,
              createdAt: new Date().toISOString(),
            });
          }

          return { messages: next };
        },
      );
    },
    [queryClient, sessionId],
  );

  const invalidateAfterTurn = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.sessions });
  }, [queryClient]);

  async function handleRetryReviewGeneration() {
    try {
      setIsRetrying(true);
      const updated = await fetchWithAuth((token) =>
        interviewApi.retryReviewGeneration(sessionId, token),
      );
      queryClient.setQueryData(queryKeys.session(sessionId), updated);
      queryClient.setQueryData<ListSessionsResponse>(
        queryKeys.sessions,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            sessions: old.sessions.map((s) =>
              s.id === sessionId ? { ...s, ...updated } : s,
            ),
          };
        },
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to retry");
    } finally {
      setIsRetrying(false);
    }
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function sendMessage(content: string) {
    if (!content || !canSend) return;

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const pendingId = `pending-human-${Date.now()}`;
    setPendingHuman({
      id: pendingId,
      role: "human",
      content,
      createdAt: new Date().toISOString(),
    });
    setIsStreaming(true);
    setStreamingContent("");
    streamingContentRef.current = "";
    abortRef.current = new AbortController();

    try {
      await streamInterviewTurn(sessionId, content, locale, token, {
        signal: abortRef.current.signal,
        onToken: (chunk) => {
          streamingContentRef.current += chunk;
          setStreamingContent((prev) => prev + chunk);
        },
        onMeta: (meta) => {
          updateSessionMeta(meta);
          if (meta.isFinished) {
            toast.success("Interview finished. Review your feedback below.");
          }
        },
      });

      mergeStreamedMessages(content, streamingContentRef.current, pendingId);
      setIsStreaming(false);
      setStreamingContent("");
      setPendingHuman(null);
      invalidateAfterTurn();
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        invalidateAfterTurn();
        return;
      }
      toast.error(err instanceof ApiError ? err.message : "Stream failed");
      invalidateAfterTurn();
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      streamingContentRef.current = "";
      setPendingHuman(null);
      abortRef.current = null;
    }
  }

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    if (!messagesQuery.isSuccess) return;
    if (serverMessages.length > 0) return;
    if (isCompleted || isStreaming || pendingHuman) return;
    if (autoStartedForSessionRef.current === sessionId) return;

    autoStartedForSessionRef.current = sessionId;
    void sendMessageRef.current(getInterviewReadyMessage(locale));
  }, [
    messagesQuery.isSuccess,
    serverMessages.length,
    sessionId,
    locale,
    isCompleted,
    isStreaming,
    pendingHuman,
  ]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    setDraft("");
    void sendMessage(content);
  }

  function handleStart() {
    void sendMessage(getInterviewReadyMessage(locale));
  }

  if (messagesQuery.isLoading) {
    return (
      <p className="text-sm text-text-base" role="status">
        Loading chat…
      </p>
    );
  }

  if (messagesQuery.error) {
    const message =
      messagesQuery.error instanceof ApiError &&
      messagesQuery.error.status === 404
        ? "Interview session not found."
        : messagesQuery.error instanceof Error
          ? messagesQuery.error.message
          : "Failed to load messages";

    return (
      <div className="mx-auto max-w-3xl space-y-2">
        <p className="text-sm text-red-700" role="alert">
          {message}
        </p>
        <Link
          href="/dashboard"
          className="cursor-pointer rounded-sm text-sm text-jade-deep underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full min-h-0">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="instrument-serif shrink-0 text-2xl leading-tight text-ink-black">
            Mock interview
          </h2>
          {displayTurns && (
            <p className="shrink-0 text-xs text-text-base">
              Turn {displayTurns.turnCount} / {displayTurns.maxTurns}
              {isCompleted && " · Finished"}
            </p>
          )}

          {isCompleted && (
            <div
              className="flex rounded-full border border-border-hairline bg-mist-gray p-0.5"
              role="group"
              aria-label="Interview view"
            >
              <button
                type="button"
                onClick={() => setViewMode("chat")}
                aria-pressed={viewMode === "chat"}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                  viewMode === "chat"
                    ? "bg-paper-white text-ink-black shadow-sm"
                    : "text-text-base hover:text-ink-black",
                )}
              >
                Chat
              </button>
              <button
                type="button"
                onClick={() => setViewMode("review")}
                aria-pressed={viewMode === "review"}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2",
                  viewMode === "review"
                    ? "bg-paper-white text-ink-black shadow-sm"
                    : "text-text-base hover:text-ink-black",
                )}
              >
                Review
              </button>
            </div>
          )}
        </div>

        {isCompleted && viewMode === "chat" && (
          <button
            type="button"
            onClick={() => setViewMode("review")}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-sm text-sm font-medium text-jade-deep underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            View review
          </button>
        )}
      </div>

      {viewMode === "chat" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <InterviewMessageList
            messages={displayMessages}
            showWelcome={showWelcome}
            onStart={handleStart}
            welcomeText={getInterviewWelcomeText(locale)}
            startLabel={getInterviewReadyMessage(locale)}
          />

          {isCompleted && (
            <div className="mt-4 shrink-0">
              <InterviewCompletionBanner
                sessionId={sessionId}
                onViewReview={() => setViewMode("review")}
              />
            </div>
          )}

          <InterviewChatInput
            draft={draft}
            onDraftChange={setDraft}
            onSubmit={handleSend}
            canSend={canSend}
            isStreaming={isStreaming}
            isFinished={isCompleted}
            locale={locale}
            getAccessToken={getAccessToken}
            onTranscript={(text) =>
              setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
            }
            sttBlocked={isStreaming}
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <InterviewReviewPanel
            sessionId={sessionId}
            messages={serverMessages}
            reviewGenerationStatus={reviewGenerationStatus}
            reviewGenerationError={reviewGenerationError}
            onRetryReviewGeneration={handleRetryReviewGeneration}
            isRetrying={isRetrying}
          />
        </div>
      )}
    </div>
  );
}
