import { apiRequest } from "./client";

type MeResponse = {
  interviewLocale: "en" | "pt" | null;
  hasCompletedTutorial: boolean;
};

export const usersApi = {
  getMe(token: string) {
    return apiRequest<MeResponse>("/api/users/me", { token });
  },
  patchInterviewLocale(token: string, locale: "en" | "pt") {
    return apiRequest<{ interviewLocale: "en" | "pt" }>(
      "/api/users/me/interview-locale",
      {
        method: "PATCH",
        body: { interviewLocale: locale },
        token,
      },
    );
  },
  completeTutorial(token: string) {
    return apiRequest<{ hasCompletedTutorial: boolean }>(
      "/api/users/me/tutorial",
      {
        method: "PATCH",
        token,
      },
    );
  },
};
