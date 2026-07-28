import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { credentials } from "better-auth-credentials-plugin";

import { serverEnv } from "@/config/server-env";

type BorderlessSignInSuccess = {
  message: string;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      emailVerified?: boolean;
      username?: string;
      careerStage?: string;
    };
    token: {
      accessToken: string;
      expiresIn: number;
    };
  };
};

type BorderlessSignInError = {
  error?: {
    code?: string;
    message?: string;
  };
};

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isBorderlessSignInSuccess(
  payload: unknown,
): payload is BorderlessSignInSuccess {
  if (!payload || typeof payload !== "object") return false;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return false;
  const user = (data as { user?: unknown }).user;
  const token = (data as { token?: unknown }).token;
  if (!user || typeof user !== "object" || !token || typeof token !== "object") {
    return false;
  }
  return (
    asNonEmptyString((user as { id?: unknown }).id) !== null &&
    asNonEmptyString((user as { email?: unknown }).email) !== null &&
    asNonEmptyString((token as { accessToken?: unknown }).accessToken) !==
      null
  );
}

function mapBorderlessErrorStatus(status: number, message: string): never {
  if (status === 429) {
    throw new APIError("TOO_MANY_REQUESTS", {
      message: message || "Too many attempts. Try again later.",
    });
  }

  if (status === 403) {
    throw new APIError("FORBIDDEN", {
      message: message || "Access denied.",
    });
  }

  if (status === 400 || status === 401 || status === 422) {
    throw new APIError("UNAUTHORIZED", {
      message: message || "Invalid credentials",
    });
  }

  throw new APIError("INTERNAL_SERVER_ERROR", {
    message:
      message ||
      `Authentication failed (Borderless HTTP ${status}). Try again.`,
  });
}

async function registerOpaqueSession(params: {
  accessToken: string;
  externalId: string;
  email: string;
  name: string;
  expiresIn: number;
}): Promise<void> {
  let response: Response;
  try {
    response = await fetch(
      `${serverEnv.SERVER_INTERNAL_URL}/internal/borderless-sessions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Auth-Secret": serverEnv.INTERNAL_AUTH_SYNC_SECRET,
        },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    console.error("[auth] borderless session register fetch failed", error);
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message:
        error instanceof Error && error.name === "TimeoutError"
          ? "API session sync timed out. Try again."
          : "Could not reach API to establish session. Try again.",
    });
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[auth] borderless session register failed", {
      status: response.status,
      detail: detail.slice(0, 300),
      url: `${serverEnv.SERVER_INTERNAL_URL}/internal/borderless-sessions`,
    });
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: `Failed to establish API session (${response.status}). Try again.`,
    });
  }
}

export const auth = betterAuth({
  database: undefined,
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: serverEnv.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: false,
  },
  session: {
    cookieCache: {
      enabled: true,
      strategy: "jwt",
    },
  },
  user: {
    additionalFields: {
      accessToken: {
        type: "string",
        returned: true,
        required: false,
      },
      externalId: {
        type: "string",
        returned: true,
        required: false,
      },
    },
  },
  plugins: [
    credentials({
      autoSignUp: true,
      providerId: "borderless",
      async callback(_ctx, parsed) {
        let response: Response;
        try {
          response = await fetch(
            `${serverEnv.BORDERLESS_API_BASE}/api/auth/signin`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                email: parsed.email,
                password: parsed.password,
              }),
              signal: AbortSignal.timeout(20_000),
            },
          );
        } catch (error) {
          console.error("[auth] Borderless signin fetch failed", error);
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message:
              error instanceof Error && error.name === "TimeoutError"
                ? "Borderless sign-in timed out. Try again."
                : "Could not reach Borderless. Try again.",
          });
        }

        const rawBody = await response.text();
        let payload: unknown;
        try {
          payload = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          payload = null;
        }

        if (!response.ok) {
          console.error("[auth] Borderless signin rejected", {
            status: response.status,
            body: rawBody.slice(0, 400),
          });
          const errorPayload =
            payload && typeof payload === "object"
              ? (payload as BorderlessSignInError)
              : null;
          const message = errorPayload?.error?.message ?? "";
          mapBorderlessErrorStatus(response.status, message);
        }

        if (!isBorderlessSignInSuccess(payload)) {
          console.error("[auth] unexpected Borderless payload", {
            status: response.status,
            body: rawBody.slice(0, 400),
          });
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Unexpected authentication response. Try again.",
          });
        }

        const borderlessUser = payload.data.user;
        const accessToken = asNonEmptyString(
          payload.data.token.accessToken,
        ) as string;
        const externalId = asNonEmptyString(borderlessUser.id) as string;
        const email = asNonEmptyString(borderlessUser.email) as string;
        const expiresIn =
          typeof payload.data.token.expiresIn === "number" &&
          payload.data.token.expiresIn > 0
            ? payload.data.token.expiresIn
            : 60 * 60 * 24;
        const name =
          asNonEmptyString(borderlessUser.name) ||
          asNonEmptyString(borderlessUser.username) ||
          "User";

        await registerOpaqueSession({
          accessToken,
          externalId,
          email,
          name,
          expiresIn,
        });

        return {
          email,
          name,
          accessToken,
          externalId,
        };
      },
    }),
    nextCookies(),
  ],
});
