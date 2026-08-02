"use client";

import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "@/features/auth/session-provider";
import { usersApi } from "@/lib/api/users";

import { mapBrowserLocale } from "./map-browser-locale";

export type InterviewLocale = "en" | "pt";

export function useInterviewLocale(): {
  locale: InterviewLocale;
  setLocale: (locale: InterviewLocale) => Promise<void>;
  isReady: boolean;
} {
  const { user, isReady: authReady, fetchWithAuth, updateUser } = useAuth();
  const bootstrappedRef = useRef(false);

  const storedLocale = user?.interviewLocale ?? null;
  const locale: InterviewLocale =
    storedLocale ??
    (typeof navigator !== "undefined"
      ? mapBrowserLocale(navigator.language)
      : "en");

  useEffect(() => {
    if (!user) {
      bootstrappedRef.current = false;
      return;
    }
    if (!authReady) return;
    if (storedLocale !== null) return;
    if (bootstrappedRef.current) return;

    bootstrappedRef.current = true;
    const candidate = mapBrowserLocale(navigator.language);

    void fetchWithAuth((token) =>
      usersApi.patchInterviewLocale(token, candidate),
    )
      .then((res) => {
        updateUser({ interviewLocale: res.interviewLocale });
      })
      .catch(() => {
        bootstrappedRef.current = false;
      });
  }, [authReady, user, storedLocale, fetchWithAuth, updateUser]);

  const setLocale = useCallback(
    async (next: InterviewLocale) => {
      const previous = user?.interviewLocale ?? null;
      updateUser({ interviewLocale: next });
      try {
        const res = await fetchWithAuth((token) =>
          usersApi.patchInterviewLocale(token, next),
        );
        updateUser({ interviewLocale: res.interviewLocale });
      } catch (err) {
        updateUser({ interviewLocale: previous });
        throw err;
      }
    },
    [fetchWithAuth, updateUser, user?.interviewLocale],
  );

  return {
    locale,
    setLocale,
    isReady: authReady && Boolean(user),
  };
}
