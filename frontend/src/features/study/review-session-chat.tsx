"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/session-provider";
import { useInterviewLocale } from "@/features/interview-locale/use-interview-locale";
import { InterviewChatInput } from "@/features/interview/interview-chat-input";
import { formatTopicAngleLabel } from "@/features/study/lib/format-topic-angle";
import {
  InterviewMessageList,
  type DisplayMessage,
} from "@/features/interview/interview-message-list";
import { InterviewMessageBubble } from "@/features/interview/interview-message-bubble";
import { ApiError } from "@/lib/api/client";
import { reviewSessionsApi } from "@/lib/api/review-sessions";
import { streamReviewSessionTurn } from "@/lib/api/review-session-stream";
import { useReviewSession } from "@/lib/query/hooks/use-review-session";
import { queryKeys } from "@/lib/query/keys";
import type {
  ReviewSession,
  ReviewSessionStreamMeta,
  ReviewSessionStreamMetaProgress,
} from "@/types/review-sessions";

import {
  appendAiMessage,
  appendHumanMessage,
  appendTopicDivider,
  type ReviewDisplayMessage,
} from "./lib/review-display-messages";
import { clearLastReviewSessionId } from "./lib/review-session-storage";
import { ReviewSessionProgress } from "./review-session-progress";

function ReviewTopicDivider({ topic }: { topic: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px flex-1 bg-border-hairline" />
      <span className="text-xs font-medium text-text-base">{topic}</span>
      <div className="h-px flex-1 bg-border-hairline" />
    </div>
  );
}

function reviewMessageToDisplay(
  message: Extract<ReviewDisplayMessage, { kind: "human" | "ai" }>,
): DisplayMessage {
  return {
    id: message.id,
    role: message.kind,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.kind === "ai" && message.streaming ? { streaming: true } : {}),
  };
}

function buildDisplayItems(
  messages: ReviewDisplayMessage[],
  isStreaming: boolean,
  streamingContent: string,
): Array<
  | { type: "topic"; id: string; topic: string }
  | { type: "message"; message: DisplayMessage }
> {
  const items: Array<
    | { type: "topic"; id: string; topic: string }
    | { type: "message"; message: DisplayMessage }
  > = [];

  for (const message of messages) {
    if (message.kind === "topic") {
      items.push({ type: "topic", id: message.id, topic: message.topic });
      continue;
    }

    items.push({
      type: "message",
      message: reviewMessageToDisplay(message),
    });
  }

  if (isStreaming) {
    if (streamingContent) {
      items.push({
        type: "message",
        message: {
          id: "streaming",
          role: "ai",
          content: streamingContent,
          createdAt: new Date().toISOString(),
          streaming: true,
        },
      });
    } else {
      items.push({
        type: "message",
        message: {
          id: "typing",
          role: "ai",
          content: "",
          createdAt: new Date().toISOString(),
          typing: true,
        },
      });
    }
  }

  return items;
}

type ReviewSessionChatProps = {
  sessionId: string;
};

export function ReviewSessionChat({ sessionId }: ReviewSessionChatProps) {
  return <ReviewSessionChatContent key={sessionId} sessionId={sessionId} />;
}

function ReviewSessionChatContent({ sessionId }: ReviewSessionChatProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { getAccessToken, fetchWithAuth } = useAuth();
  const { locale } = useInterviewLocale();
  const sessionQuery = useReviewSession(sessionId);
  const session = sessionQuery.data;

  const [messages, setMessages] = useState<ReviewDisplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [progressMeta, setProgressMeta] =
    useState<ReviewSessionStreamMetaProgress | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const streamingContentRef = useRef("");
  const lastItemIndexRef = useRef(-1);
  const sessionItemsRef = useRef(session?.items ?? []);

  useLayoutEffect(() => {
    sessionItemsRef.current = session?.items ?? [];
  }, [session?.items]);

  const canSend =
    session?.status === "in_progress" && !isStreaming && !isRedirecting;
  const showWelcome =
    messages.length === 0 && !isStreaming && session?.status === "in_progress";

  const resolveTopicName = useCallback(
    (meta: ReviewSessionStreamMetaProgress) => {
      const items = sessionItemsRef.current;
      const item =
        items[meta.itemIndex] ??
        items.find((entry) => entry.id === meta.reviewSessionItemId);

      if (!item) {
        return "Next topic";
      }

      return formatTopicAngleLabel(item.topic, item.angle);
    },
    [],
  );

  const handleProgressMeta = useCallback(
    (meta: ReviewSessionStreamMetaProgress) => {
      setProgressMeta(meta);

      if (meta.itemIndex !== lastItemIndexRef.current) {
        if (
          lastItemIndexRef.current >= 0 &&
          meta.itemIndex > lastItemIndexRef.current
        ) {
          setMessages((current) =>
            appendTopicDivider(current, resolveTopicName(meta), meta.itemIndex),
          );
        }

        lastItemIndexRef.current = meta.itemIndex;
      }
    },
    [resolveTopicName],
  );

  const seedReportCache = useCallback(
    (meta: Extract<ReviewSessionStreamMeta, { status: "pending_review" }>) => {
      queryClient.setQueryData<ReviewSession>(
        queryKeys.reviewSession(sessionId),
        {
          id: sessionId,
          status: "pending_review",
          items: meta.report.map((item) => ({
            id: item.reviewSessionItemId,
            reviewItemId: item.reviewItemId,
            topic: item.topic,
            angle: item.angle,
            currentPriority: item.currentPriority,
            suggestedStatus: item.suggestedStatus,
            suggestedPriority: item.suggestedPriority,
            confirmedStatus: null,
            confirmedPriority: null,
            turns: [],
          })),
        },
      );
    },
    [queryClient, sessionId],
  );

  const redirectForSession = useCallback(
    (nextSession: ReviewSession) => {
      setIsRedirecting(true);

      if (nextSession.status === "pending_review") {
        router.replace(`/review-session/${sessionId}/report`);
        return;
      }

      if (nextSession.status === "completed") {
        router.replace("/study");
      }
    },
    [router, sessionId],
  );

  const handleStreamConflict = useCallback(async () => {
    try {
      const nextSession = await fetchWithAuth((token) =>
        reviewSessionsApi.getById(token, sessionId),
      );
      redirectForSession(nextSession);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Failed to load review session",
      );
    }
  }, [fetchWithAuth, redirectForSession, sessionId]);

  useEffect(() => {
    if (!session) {
      return;
    }

    if (session.status === "pending_review") {
      router.replace(`/review-session/${sessionId}/report`);
      return;
    }

    if (session.status === "completed") {
      router.replace("/study");
    }
  }, [router, session, sessionId]);

  useEffect(() => {
    if (
      sessionQuery.error instanceof ApiError &&
      sessionQuery.error.status === 404
    ) {
      toast.error("Review session not found");
      clearLastReviewSessionId();
      router.replace("/study");
    }
  }, [router, sessionQuery.error]);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  async function sendTurn(answer: string | undefined) {
    if (answer !== undefined) {
      if (!canSend) {
        return;
      }

      const trimmedAnswer = answer.trim();
      if (!trimmedAnswer) {
        return;
      }
    } else if (isStreaming || isRedirecting) {
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    const trimmedAnswer = answer?.trim();
    if (trimmedAnswer) {
      setMessages((current) => appendHumanMessage(current, trimmedAnswer));
    }

    setIsStreaming(true);
    setStreamingContent("");
    streamingContentRef.current = "";
    abortRef.current = new AbortController();

    let pendingReviewComplete = false;

    try {
      await streamReviewSessionTurn(sessionId, trimmedAnswer, locale, token, {
        signal: abortRef.current.signal,
        onToken: (chunk) => {
          streamingContentRef.current += chunk;
          setStreamingContent((prev) => prev + chunk);
        },
        onMeta: (meta) => {
          if (meta.status === "pending_review") {
            pendingReviewComplete = true;
            seedReportCache(meta);
            setIsRedirecting(true);
            router.push(`/review-session/${sessionId}/report`);
            return;
          }

          handleProgressMeta(meta);
        },
      });

      if (pendingReviewComplete) {
        return;
      }

      const aiContent = streamingContentRef.current;
      if (aiContent) {
        setMessages((current) => appendAiMessage(current, aiContent));
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      if (err instanceof ApiError && err.status === 409) {
        await handleStreamConflict();
        return;
      }

      toast.error(err instanceof ApiError ? err.message : "Stream failed");
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      streamingContentRef.current = "";
      abortRef.current = null;
    }
  }

  function handleStart() {
    void sendTurn(undefined);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }
    setDraft("");
    void sendTurn(content);
  }

  const displayItems = useMemo(
    () => buildDisplayItems(messages, isStreaming, streamingContent),
    [isStreaming, messages, streamingContent],
  );

  const hasTopicDividers = useMemo(
    () => messages.some((message) => message.kind === "topic"),
    [messages],
  );

  const chatOnlyMessages = useMemo(
    () =>
      displayItems
        .filter(
          (item): item is { type: "message"; message: DisplayMessage } =>
            item.type === "message",
        )
        .map((item) => item.message),
    [displayItems],
  );

  if (sessionQuery.isLoading) {
    return (
      <p className="text-sm text-text-base" role="status">
        Loading review session…
      </p>
    );
  }

  if (sessionQuery.error && !(sessionQuery.error instanceof ApiError)) {
    return (
      <div className="mx-auto max-w-3xl space-y-2">
        <p className="text-sm text-red-700" role="alert">
          {sessionQuery.error instanceof Error
            ? sessionQuery.error.message
            : "Failed to load review session"}
        </p>
        <Link
          href="/study"
          className="cursor-pointer rounded-sm text-sm text-jade-deep underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          Back to Study
        </Link>
      </div>
    );
  }

  if (isRedirecting) {
    return (
      <p className="text-sm text-text-base" role="status">
        Redirecting…
      </p>
    );
  }

  if (session && session.status !== "in_progress") {
    return (
      <p className="text-sm text-text-base" role="status">
        Redirecting…
      </p>
    );
  }

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h1 className="instrument-serif text-2xl leading-tight text-ink-black">
          Review session
        </h1>
        <ReviewSessionProgress meta={progressMeta} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {hasTopicDividers ? (
          <div className="flex-1 space-y-4 overflow-y-auto rounded-[20px] bg-paper-white p-4 shadow-(--shadow-subtle-3)">
            {displayItems.map((item) => {
              if (item.type === "topic") {
                return <ReviewTopicDivider key={item.id} topic={item.topic} />;
              }

              const message = item.message;
              return (
                <InterviewMessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  isStreaming={
                    "streaming" in message && Boolean(message.streaming)
                  }
                  isTyping={"typing" in message && Boolean(message.typing)}
                />
              );
            })}
          </div>
        ) : (
          <InterviewMessageList
            messages={chatOnlyMessages}
            showWelcome={showWelcome}
            onStart={handleStart}
            welcomeText="When you're ready, click to begin your review session."
            startLabel="Start review session"
          />
        )}

        <InterviewChatInput
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={handleSubmit}
          canSend={canSend}
          isStreaming={isStreaming}
          isFinished={false}
          locale={locale}
          getAccessToken={getAccessToken}
          onTranscript={(text) =>
            setDraft((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
          }
          sttBlocked={isStreaming}
        />
      </div>
    </div>
  );
}
