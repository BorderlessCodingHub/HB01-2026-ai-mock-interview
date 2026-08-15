"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";

import { getSttCopy } from "@/features/interview/stt-copy";
import { useAudioRecorder } from "@/features/interview/use-audio-recorder";
import { ApiError } from "@/lib/api/client";
import { transcribeAudio } from "@/lib/api/transcribe";

type InterviewMicControlProps = {
  locale: "en" | "pt";
  getAccessToken: () => Promise<string | null>;
  onTranscript: (text: string) => void;
  onBusyChange?: (isBusy: boolean) => void;
  isStartDisabled?: boolean;
};

function formatElapsedTime(elapsedMs: number) {
  const totalSeconds = Math.floor(elapsedMs / 1_000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export function InterviewMicControl({
  locale,
  getAccessToken,
  onTranscript,
  onBusyChange,
  isStartDisabled = false,
}: InterviewMicControlProps) {
  const copy = getSttCopy(locale);
  const recorder = useAudioRecorder();
  const [isTranscribing, setIsTranscribing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  const isBusy = recorder.status !== "idle" || isTranscribing;

  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(() => {
    if (!recorder.error) return;

    toast.error(
      recorder.error.kind === "permission"
        ? copy.permissionDenied
        : recorder.error.kind === "unsupported"
          ? copy.unsupported
          : copy.genericError,
    );
  }, [copy.genericError, copy.permissionDenied, copy.unsupported, recorder.error]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  async function handleTranscribe() {
    if (!recorder.blob || recorder.isTooShort) {
      toast.error(copy.tooShort);
      recorder.discard();
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setIsTranscribing(true);

    try {
      const token = await getAccessToken();
      if (!token) {
        throw new Error("Missing access token");
      }

      const response = await transcribeAudio(recorder.blob, token, {
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) return;

      const transcript = response.text.trim();

      if (!transcript) {
        throw new Error("Empty transcript");
      }

      onTranscript(transcript);
      toast.success(copy.success);
      recorder.discard();
    } catch (error) {
      if (isAbortError(error)) {
        recorder.discard();
        return;
      }

      if (error instanceof ApiError) {
        toast.error(
          error.status === 429
            ? copy.rateLimited
            : error.status === 504
              ? copy.timeout
              : error.status === 400
                ? copy.noSpeechDetected
                : copy.genericError,
        );
      } else {
        toast.error(copy.genericError);
      }
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
        if (isMountedRef.current) {
          setIsTranscribing(false);
        }
      }
    }
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  const buttonClassName =
    "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-border-hairline bg-paper-white px-3 py-2.5 text-sm font-semibold text-ink-black transition-colors hover:bg-mist-gray disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2";

  if (isTranscribing) {
    return (
      <button type="button" onClick={handleCancel} className={buttonClassName}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {copy.cancel}
      </button>
    );
  }

  if (recorder.status === "recording") {
    return (
      <button type="button" onClick={recorder.stop} className={buttonClassName}>
        <span
          className="relative flex h-3 w-3"
          aria-label={copy.stop}
          role="status"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-jade opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-jade-deep" />
        </span>
        <span className="tabular-nums">{formatElapsedTime(recorder.elapsedMs)}</span>
        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
        <span className="sr-only">{copy.stop}</span>
      </button>
    );
  }

  if (recorder.status === "pendingConfirm") {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleTranscribe}
          className={buttonClassName}
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          {copy.transcribe}
        </button>
        <button
          type="button"
          onClick={recorder.discard}
          className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-full border border-border-hairline bg-paper-white text-ink-black transition-colors hover:bg-mist-gray focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
          aria-label={copy.discard}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void recorder.start()}
      disabled={isStartDisabled}
      className={buttonClassName}
    >
      <Mic className="h-4 w-4" aria-hidden="true" />
      <span className="sr-only">{copy.record}</span>
    </button>
  );
}
