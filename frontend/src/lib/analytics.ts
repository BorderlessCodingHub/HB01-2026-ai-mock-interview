import posthog from "posthog-js";

export type AnalyticsEvent =
  | { name: "practice_session_started"; properties: { level: string; turns: number } }
  | { name: "onboarding_completed"; properties: { status: "finished" | "skipped" } };

export function trackEvent(event: AnalyticsEvent): void {
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  posthog.capture(event.name, event.properties);
}
