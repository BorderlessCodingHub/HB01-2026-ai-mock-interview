import type { UserWithoutPassword } from "@/types/auth";

const ACCESS_TOKEN_KEY = "hone_access_token";
const USER_KEY = "hone_user";
const LOCALE_KEY = "hone_interview_locale";
const RESUME_ID_KEY = "hone_resume_id";

export type AuthSession = {
  accessToken: string;
  user: UserWithoutPassword;
};

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  const userRaw = localStorage.getItem(USER_KEY);

  if (!accessToken || !userRaw) return null;

  try {
    const user = JSON.parse(userRaw) as UserWithoutPassword;
    const locale = localStorage.getItem(LOCALE_KEY) as "en" | "pt" | null;
    return {
      accessToken,
      user: {
        ...user,
        interviewLocale: locale ?? user.interviewLocale ?? null,
        hasCompletedTutorial: user.hasCompletedTutorial ?? false,
      },
    };
  } catch {
    return null;
  }
}

export function setStoredSession(session: AuthSession): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, session.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  if (session.user.interviewLocale) {
    localStorage.setItem(LOCALE_KEY, session.user.interviewLocale);
  }
}

export function clearStoredSession(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LOCALE_KEY);
  localStorage.removeItem("hone_refresh_token");
}

export function getStoredResumeId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(RESUME_ID_KEY);
}

export function setStoredResumeId(resumeId: string): void {
  localStorage.setItem(RESUME_ID_KEY, resumeId);
}

export function clearStoredResumeId(): void {
  localStorage.removeItem(RESUME_ID_KEY);
}
