"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CircleAlert,
  CloudOff,
  Loader2,
  RotateCw,
  SearchX,
  WifiOff,
  type LucideIcon,
} from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type ErrorKind = "server" | "network" | "notFound" | "other";

function getErrorKind(error: unknown): ErrorKind {
  if (error instanceof ApiError) {
    if (error.status >= 500) return "server";
    if (error.status === 404) return "notFound";
    return "other";
  }
  // fetch() rejects with a TypeError when the request never reaches a server.
  if (error instanceof TypeError) return "network";
  return "other";
}

/**
 * User-facing text for a failed request. Server errors (5xx) and network
 * failures get a friendly message instead of raw text such as
 * "Internal server error"; 4xx messages are written for users, so keep them.
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  switch (getErrorKind(error)) {
    case "server":
      return "Something went wrong on our side. Please try again in a moment.";
    case "network":
      return "We couldn't reach Hone. Check your connection and try again.";
    default:
      return error instanceof ApiError && error.message
        ? error.message
        : fallback;
  }
}

const ICONS: Record<ErrorKind, LucideIcon> = {
  server: CloudOff,
  network: WifiOff,
  notFound: SearchX,
  other: CircleAlert,
};

type AppErrorStateProps = {
  title: string;
  error: unknown;
  /** Shown when the error carries no user-facing message. */
  fallbackMessage?: string;
  onRetry?: () => void;
  isRetrying?: boolean;
  backHref?: string;
  backLabel?: string;
  headingLevel?: 1 | 2 | 3;
  /**
   * `panel` fills a page or main area; `inline` is a slim row for a tab,
   * list or section inside an otherwise working page.
   */
  variant?: "panel" | "inline";
  className?: string;
};

function RetryButton({
  onRetry,
  isRetrying,
  size,
}: {
  onRetry: () => void;
  isRetrying: boolean;
  size: "md" | "sm";
}) {
  return (
    <button
      type="button"
      onClick={onRetry}
      disabled={isRetrying}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-jade-deep font-semibold text-white transition-colors hover:bg-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        size === "md" ? "h-11 px-5 text-sm" : "h-9 px-4 text-xs",
      )}
    >
      {isRetrying ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <RotateCw className="h-4 w-4" aria-hidden />
      )}
      {isRetrying ? "Trying again…" : "Try again"}
    </button>
  );
}

/** Calm, on-brand error with a retry action for a failed load. */
export function AppErrorState({
  title,
  error,
  fallbackMessage = "Please try again.",
  onRetry,
  isRetrying = false,
  backHref,
  backLabel = "Go back",
  headingLevel = 2,
  variant = "panel",
  className,
}: AppErrorStateProps) {
  const Heading = headingLevel === 1 ? "h1" : headingLevel === 2 ? "h2" : "h3";
  const Icon = ICONS[getErrorKind(error)];
  const message = getErrorMessage(error, fallbackMessage);

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-border-hairline bg-jade-pale/60 p-4 sm:flex-row sm:items-center sm:gap-4",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper-white text-jade-deep shadow-(--shadow-subtle-3)"
            aria-hidden
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Heading className="text-sm font-semibold text-ink-black">
              {title}
            </Heading>
            <p className="mt-0.5 text-sm leading-6 text-text-base text-pretty">
              {message}
            </p>
          </div>
        </div>
        {onRetry && (
          <RetryButton onRetry={onRetry} isRetrying={isRetrying} size="sm" />
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "landing-artifact landing-jade-wash relative flex flex-col items-center justify-center overflow-hidden px-6! py-12! text-center sm:px-10! sm:py-16!",
        className,
      )}
    >
      <span
        className="flex size-16 items-center justify-center rounded-[20px] bg-paper-white text-jade-deep shadow-(--shadow-subtle-3) ring-1 ring-border-hairline"
        aria-hidden
      >
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </span>
      <Heading className="instrument-serif mt-6 text-3xl leading-tight tracking-[-0.01em] text-ink-black text-balance sm:text-[2.25rem]">
        {title}
      </Heading>
      <p className="manrope mt-3 max-w-md text-[15px] leading-relaxed text-text-base text-pretty">
        {message}
      </p>
      {(onRetry || backHref) && (
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          {onRetry && (
            <RetryButton onRetry={onRetry} isRetrying={isRetrying} size="md" />
          )}
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-border-hairline bg-paper-white px-5 text-sm font-medium text-ink-black transition-colors hover:border-ink-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade focus-visible:ring-offset-2"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              {backLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
