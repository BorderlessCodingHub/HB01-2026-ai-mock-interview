import { describe, expect, it } from "vitest";

import {
  feedbackPromptDismissedKey,
  getFeedbackWidgetView,
  readFeedbackPromptDismissed,
  writeFeedbackPromptDismissed,
} from "./feedback-prompt";

const rated = {
  rating: "up" as const,
  comment: null,
  updatedAt: "2026-11-20T10:00:00.000Z",
};

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}

describe("getFeedbackWidgetView", () => {
  it("asks for a rating when the session was never rated nor dismissed", () => {
    expect(
      getFeedbackWidgetView({
        feedback: null,
        dismissed: false,
        isEditing: false,
      }),
    ).toBe("form");
  });

  it("treats a missing feedback field like an unrated session", () => {
    expect(
      getFeedbackWidgetView({
        feedback: undefined,
        dismissed: false,
        isEditing: false,
      }),
    ).toBe("form");
  });

  it("never asks again once the server reports a rating", () => {
    expect(
      getFeedbackWidgetView({
        feedback: rated,
        dismissed: false,
        isEditing: false,
      }),
    ).toBe("rated");
  });

  it("prefers the rating over an earlier dismissal", () => {
    expect(
      getFeedbackWidgetView({ feedback: rated, dismissed: true, isEditing: false }),
    ).toBe("rated");
  });

  it("stays collapsed after the prompt was dismissed", () => {
    expect(
      getFeedbackWidgetView({ feedback: null, dismissed: true, isEditing: false }),
    ).toBe("dismissed");
  });

  it("shows the form while the user is editing", () => {
    expect(
      getFeedbackWidgetView({ feedback: rated, dismissed: true, isEditing: true }),
    ).toBe("form");
  });
});

describe("feedback prompt dismissal storage", () => {
  it("remembers a dismissal per session", () => {
    const storage = createMemoryStorage();

    writeFeedbackPromptDismissed(storage, "session-a");

    expect(readFeedbackPromptDismissed(storage, "session-a")).toBe(true);
    expect(readFeedbackPromptDismissed(storage, "session-b")).toBe(false);
    expect(storage.values.get(feedbackPromptDismissedKey("session-a"))).toBe(
      "1",
    );
  });

  it("falls back to not dismissed when storage is unavailable or throws", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };

    expect(readFeedbackPromptDismissed(null, "session-a")).toBe(false);
    expect(readFeedbackPromptDismissed(throwing, "session-a")).toBe(false);
    expect(() =>
      writeFeedbackPromptDismissed(throwing, "session-a"),
    ).not.toThrow();
  });
});
