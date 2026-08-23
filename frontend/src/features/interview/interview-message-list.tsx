"use client";

import { useLayoutEffect, useRef } from "react";

import type { SessionMessage } from "@/types/interview";

import { InterviewMessageBubble } from "./interview-message-bubble";
import {
  getInterviewReadyMessage,
  getInterviewWelcomeText,
} from "./interview-ready-message";

export type DisplayMessage =
  | SessionMessage
  | {
      id: string;
      role: "human" | "ai";
      content: string;
      createdAt: string;
      streaming?: boolean;
      typing?: boolean;
    };

type InterviewMessageListProps = {
  messages: DisplayMessage[];
  showWelcome: boolean;
  onStart?: () => void;
  welcomeText?: string;
  startLabel?: string;
  hasMoreOlder?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
};

export function InterviewMessageList({
  messages,
  showWelcome,
  onStart,
  welcomeText = getInterviewWelcomeText("en"),
  startLabel = getInterviewReadyMessage("en"),
  hasMoreOlder = false,
  isLoadingOlder = false,
  onLoadOlder,
}: InterviewMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isLoadingOlderChangeRef = useRef(false);
  const prevScrollHeightRef = useRef<number | null>(null);

  function handleLoadOlder() {
    if (scrollRef.current) {
      prevScrollHeightRef.current = scrollRef.current.scrollHeight;
    }
    isLoadingOlderChangeRef.current = true;
    onLoadOlder?.();
  }

  useLayoutEffect(() => {
    const container = scrollRef.current;

    if (isLoadingOlderChangeRef.current) {
      isLoadingOlderChangeRef.current = false;
      if (container && prevScrollHeightRef.current !== null) {
        container.scrollTop += container.scrollHeight - prevScrollHeightRef.current;
      }
      prevScrollHeightRef.current = null;
      return;
    }

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 space-y-4 overflow-y-auto rounded-[20px] bg-paper-white p-4 shadow-(--shadow-subtle-3)"
    >
      {hasMoreOlder && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={handleLoadOlder}
            disabled={isLoadingOlder}
            className="cursor-pointer rounded-full border border-border-hairline px-4 py-1.5 text-xs font-medium text-text-base transition-colors hover:bg-mist-gray disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            {isLoadingOlder ? "Loading…" : "Load older messages"}
          </button>
        </div>
      )}

      {showWelcome && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <p className="text-sm text-text-base">{welcomeText}</p>
          <button
            type="button"
            onClick={onStart}
            className="cursor-pointer rounded-full bg-jade-deep px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          >
            {startLabel}
          </button>
        </div>
      )}

      {messages.map((msg) => (
        <InterviewMessageBubble
          key={msg.id}
          role={msg.role}
          content={msg.content}
          isStreaming={"streaming" in msg && Boolean(msg.streaming)}
          isTyping={"typing" in msg && Boolean(msg.typing)}
        />
      ))}

      <div ref={bottomRef} aria-hidden />
    </div>
  );
}
