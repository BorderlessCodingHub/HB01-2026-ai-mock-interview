"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth/session-provider";
import { usersApi } from "@/lib/api/users";

export function useOnboardingTutorial(): {
  shouldRun: boolean;
  complete: () => void;
} {
  const { user, isReady: authReady, fetchWithAuth, updateUser } = useAuth();
  const [isSynced, setIsSynced] = useState(false);
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!authReady || !user) {
      syncedRef.current = false;
      setIsSynced(false);
      return;
    }
    if (syncedRef.current) return;
    syncedRef.current = true;

    void fetchWithAuth((token) => usersApi.getMe(token))
      .then((res) => {
        updateUser({ hasCompletedTutorial: res.hasCompletedTutorial });
        setIsSynced(true);
      })
      .catch(() => {
        syncedRef.current = false;
      });
  }, [authReady, user, fetchWithAuth, updateUser]);

  const complete = useCallback(() => {
    updateUser({ hasCompletedTutorial: true });
    void fetchWithAuth((token) => usersApi.completeTutorial(token)).catch(
      () => {
        updateUser({ hasCompletedTutorial: false });
      },
    );
  }, [fetchWithAuth, updateUser]);

  const shouldRun =
    isSynced && authReady && Boolean(user) && !user?.hasCompletedTutorial;

  return { shouldRun, complete };
}
