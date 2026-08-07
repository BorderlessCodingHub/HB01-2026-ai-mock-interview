"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { authClient } from "@/lib/auth/auth-client";
import { env } from "@/config/env";
import type { UserWithoutPassword } from "@/types/auth";

import {
  clearStoredSession,
  getStoredSession,
  setStoredSession,
  type AuthSession,
} from "./session-storage";

type AuthContextValue = {
  user: UserWithoutPassword | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<UserWithoutPassword>) => void;
  getAccessToken: () => Promise<string | null>;
  fetchWithAuth: <T>(request: (token: string) => Promise<T>) => Promise<T>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const sessionListeners = new Set<() => void>();

let cachedFingerprint = "";
let cachedSession: AuthSession | null = null;

function sessionFingerprint(session: AuthSession | null): string {
  if (!session) return "";
  return `${session.accessToken}|${session.user.id}|${session.user.email}|${session.user.interviewLocale ?? ""}`;
}

function invalidateSessionCache() {
  cachedFingerprint = "";
  cachedSession = null;
}

function getSessionSnapshot(): AuthSession | null {
  const next = getStoredSession();
  const fp = sessionFingerprint(next);
  if (fp === cachedFingerprint) {
    return cachedSession;
  }
  cachedFingerprint = fp;
  cachedSession = next;
  return cachedSession;
}

function subscribeSession(onStoreChange: () => void) {
  sessionListeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    sessionListeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function notifySessionChange() {
  invalidateSessionCache();
  sessionListeners.forEach((listener) => listener());
}

const emptySnapshot = null as AuthSession | null;

function extractErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Failed to sign in";
}

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    () => emptySnapshot,
  );
  const isReady = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const persistSession = useCallback((next: AuthSession) => {
    setStoredSession(next);
    notifySessionChange();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await authClient.signIn.credentials({
        email,
        password,
      });

      if (result.error) {
        throw new ApiError(
          result.error.message || "Invalid credentials",
          result.error.status || 401,
        );
      }

      const data = result.data as
        | {
            user?: {
              email: string;
              name: string;
              accessToken?: string;
              externalId?: string;
            };
          }
        | undefined;

      const accessToken = data?.user?.accessToken;
      const externalId = data?.user?.externalId;
      const userEmail = data?.user?.email ?? email;
      const userName = data?.user?.name ?? email.split("@")[0] ?? "User";

      if (!accessToken || !externalId) {
        // Fallback: read session from better-auth
        const sessionResult = await authClient.getSession();
        const sessionUser = sessionResult.data?.user as
          | {
              email?: string;
              name?: string;
              accessToken?: string;
              externalId?: string;
            }
          | undefined;

        if (!sessionUser?.accessToken || !sessionUser.externalId) {
          throw new ApiError("Sign-in succeeded but token is missing", 500);
        }

        persistSession({
          accessToken: sessionUser.accessToken,
          user: {
            id: sessionUser.externalId,
            email: sessionUser.email ?? userEmail,
            name: sessionUser.name ?? userName,
            interviewLocale: null,
            hasCompletedTutorial: false,
          },
        });
      } else {
        persistSession({
          accessToken,
          user: {
            id: externalId,
            email: userEmail,
            name: userName,
            interviewLocale: null,
            hasCompletedTutorial: false,
          },
        });
      }

      router.push("/dashboard");
    },
    [persistSession, router],
  );

  const logout = useCallback(async () => {
    const token = getSessionSnapshot()?.accessToken;
    if (token) {
      try {
        await fetch(
          `${env.NEXT_PUBLIC_SERVER_URL}/internal/borderless-sessions`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            credentials: "include",
          },
        );
      } catch {
        // Best-effort: local logout still proceeds
      }
    }

    await authClient.signOut();
    clearStoredSession();
    notifySessionChange();
    router.push("/login");
  }, [router]);

  const updateUser = useCallback(
    (partial: Partial<UserWithoutPassword>) => {
      const current = getSessionSnapshot();
      if (!current) return;
      persistSession({
        ...current,
        user: { ...current.user, ...partial },
      });
    },
    [persistSession],
  );

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return getSessionSnapshot()?.accessToken ?? null;
  }, []);

  const fetchWithAuth = useCallback(
    async <T,>(request: (token: string) => Promise<T>): Promise<T> => {
      const token = await getAccessToken();
      if (!token) throw new ApiError("Not authenticated", 401);
      try {
        return await request(token);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearStoredSession();
          notifySessionChange();
          try {
            await authClient.signOut();
          } catch {
            // Ignore sign-out failures after session already cleared
          }
          router.push("/login");
        }
        throw err;
      }
    },
    [getAccessToken, router],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: Boolean(session?.accessToken),
      isReady,
      login,
      logout,
      updateUser,
      getAccessToken,
      fetchWithAuth,
    }),
    [
      session,
      isReady,
      login,
      logout,
      updateUser,
      getAccessToken,
      fetchWithAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthSessionProvider");
  }
  return ctx;
}

export { extractErrorMessage };
