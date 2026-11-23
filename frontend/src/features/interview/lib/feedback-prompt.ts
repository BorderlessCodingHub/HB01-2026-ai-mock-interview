import type { SessionFeedbackSummary } from "@/types/interview";

/**
 * What the "Was this interview helpful?" widget shows for a finished session.
 *
 * - `form`: ask for a rating (never rated and never dismissed, or editing).
 * - `rated`: the user already rated it (server-backed), so only a short
 *   confirmation with an "Edit" link is shown — never the prompt again.
 * - `dismissed`: the user chose "Not now"; a discreet link lets them rate later.
 */
export type FeedbackWidgetView = "form" | "rated" | "dismissed";

export function getFeedbackWidgetView({
  feedback,
  dismissed,
  isEditing,
}: {
  feedback: SessionFeedbackSummary | null | undefined;
  dismissed: boolean;
  isEditing: boolean;
}): FeedbackWidgetView {
  if (isEditing) return "form";
  if (feedback) return "rated";
  if (dismissed) return "dismissed";
  return "form";
}

const DISMISSED_KEY_PREFIX = "hone:interview-feedback-dismissed:";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export function feedbackPromptDismissedKey(sessionId: string): string {
  return `${DISMISSED_KEY_PREFIX}${sessionId}`;
}

/** Storage can be missing or throw (private mode, blocked site data). */
export function readFeedbackPromptDismissed(
  storage: KeyValueStorage | null,
  sessionId: string,
): boolean {
  if (!storage) return false;
  try {
    return storage.getItem(feedbackPromptDismissedKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

export function writeFeedbackPromptDismissed(
  storage: KeyValueStorage | null,
  sessionId: string,
): void {
  if (!storage) return;
  try {
    storage.setItem(feedbackPromptDismissedKey(sessionId), "1");
  } catch {
    // Best effort: the prompt simply shows again next visit.
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();

/** `useSyncExternalStore` subscription: same-tab writes and other tabs. */
export function subscribeFeedbackPromptDismissal(
  listener: () => void,
): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function isFeedbackPromptDismissed(sessionId: string): boolean {
  return readFeedbackPromptDismissed(getLocalStorage(), sessionId);
}

export function dismissFeedbackPrompt(sessionId: string): void {
  writeFeedbackPromptDismissed(getLocalStorage(), sessionId);
  for (const listener of listeners) listener();
}
