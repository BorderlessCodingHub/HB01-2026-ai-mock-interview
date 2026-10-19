"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";

import { useAuth } from "@/features/auth/session-provider";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

// Initialized at module scope (not in a useEffect) so it always runs before
// any capture() call — child effects fire before parent effects on mount,
// so an effect here would race PostHogPageviewTracker's first capture.
if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
  });
}

function PostHogPageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!POSTHOG_KEY) return;
    const query = searchParams.toString();
    posthog.capture("$pageview", {
      $current_url: query ? `${pathname}?${query}` : pathname,
    });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const identifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_KEY) return;

    if (isAuthenticated && user && identifiedUserId.current !== user.id) {
      posthog.identify(user.id, { email: user.email, name: user.name });
      identifiedUserId.current = user.id;
    }

    if (!isAuthenticated && identifiedUserId.current) {
      posthog.reset();
      identifiedUserId.current = null;
    }
  }, [isAuthenticated, user]);

  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageviewTracker />
      </Suspense>
      {children}
    </>
  );
}
