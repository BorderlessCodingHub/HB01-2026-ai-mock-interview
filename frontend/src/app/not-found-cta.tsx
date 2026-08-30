"use client";

import Link from "next/link";

import { useAuth } from "@/features/auth/session-provider";

const ctaClassName =
  "inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-jade-deep bg-jade-deep px-5 text-sm font-medium text-paper-white transition-colors hover:border-ink-black hover:bg-ink-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-deep";

export function NotFoundCta() {
  const { isAuthenticated, isReady } = useAuth();

  if (!isReady) {
    return (
      <span
        className="inline-flex h-11 items-center px-5"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading…</span>
      </span>
    );
  }

  if (isAuthenticated) {
    return (
      <Link href="/dashboard" className={ctaClassName}>
        Back to dashboard
      </Link>
    );
  }

  return (
    <Link href="/" className={ctaClassName}>
      Back to home
    </Link>
  );
}
