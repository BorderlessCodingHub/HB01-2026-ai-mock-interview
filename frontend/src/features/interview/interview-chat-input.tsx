import { useEffect, useId, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { InterviewMicControl } from "@/features/interview/interview-mic-control";

const TEXTAREA_MAX_HEIGHT_PX = 160;

type InterviewChatInputProps = {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  canSend: boolean;
  isStreaming: boolean;
  isFinished: boolean;
  locale?: "en" | "pt";
  getAccessToken?: () => Promise<string | null>;
  onTranscript?: (text: string) => void;
  sttBlocked?: boolean;
};

export function InterviewChatInput({
  draft,
  onDraftChange,
  onSubmit,
  canSend,
  isStreaming,
  isFinished,
  locale,
  getAccessToken,
  onTranscript,
  sttBlocked = false,
}: InterviewChatInputProps) {
  const inputId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isSttBusy, setIsSttBusy] = useState(false);
  const hasSpeechToText = Boolean(locale && getAccessToken && onTranscript);
  const isInputDisabled = !canSend || isSttBusy || sttBlocked;
  const placeholder = canSend
    ? "Type your answer…"
    : isFinished
      ? "Interview finished"
      : isStreaming
        ? "AI is responding…"
        : "Cannot send right now";

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT_PX)}px`;
  }, [draft]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (isInputDisabled || !draft.trim()) return;
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="mt-4 space-y-2">
      {isStreaming && (
        <p className="text-xs text-text-base" role="status">
          AI is responding…
        </p>
      )}

      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <label htmlFor={inputId} className="sr-only">
          Interview response
        </label>
        <textarea
          ref={textareaRef}
          id={inputId}
          rows={1}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isInputDisabled}
          aria-busy={isStreaming}
          className="min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-2xl border border-border-hairline bg-paper-white px-4 py-2.5 text-sm text-ink-black placeholder:text-text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:opacity-50"
        />
        {hasSpeechToText && locale && getAccessToken && onTranscript && (
          <InterviewMicControl
            locale={locale}
            getAccessToken={getAccessToken}
            onTranscript={onTranscript}
            onBusyChange={setIsSttBusy}
            isStartDisabled={!canSend || isStreaming || sttBlocked}
          />
        )}
        <button
          type="submit"
          disabled={isInputDisabled || !draft.trim()}
          className="flex min-h-11 min-w-22 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-jade-deep px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-black disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
        >
          {isStreaming ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sending…
            </>
          ) : (
            "Send"
          )}
        </button>
      </form>
    </div>
  );
}
