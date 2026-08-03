"use client";

import { useEffect, useRef } from "react";

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
};

export function InterviewMessageList({
  messages,
  showWelcome,
  onStart,
  welcomeText = getInterviewWelcomeText("en"),
  startLabel = getInterviewReadyMessage("en"),
}: InterviewMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 space-y-4 overflow-y-auto rounded-[20px] bg-paper-white p-4 shadow-(--shadow-subtle-3)"
    >
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
