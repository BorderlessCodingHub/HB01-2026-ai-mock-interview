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
    typeof (user as { id?: unknown }).id === "string" &&
    typeof (user as { email?: unknown }).email === "string" &&
    typeof (token as { accessToken?: unknown }).accessToken === "string"
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

  if (status === 400 || status === 401) {
    throw new APIError("UNAUTHORIZED", {
      message: message || "Invalid credentials",
    });
  }

  throw new APIError("INTERNAL_SERVER_ERROR", {
    message: message || "Authentication failed. Try again.",
  });
}

async function registerOpaqueSession(params: {
  accessToken: string;
  externalId: string;
  email: string;
  name: string;
  expiresIn: number;
}): Promise<void> {
  const response = await fetch(
    `${serverEnv.SERVER_INTERNAL_URL}/internal/borderless-sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth-Secret": serverEnv.INTERNAL_AUTH_SYNC_SECRET,
      },
      body: JSON.stringify(params),
    },
  );

  if (!response.ok) {
    throw new APIError("INTERNAL_SERVER_ERROR", {
      message: "Failed to establish API session. Try again.",
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
        required: true,
      },
      externalId: {
        type: "string",
        returned: true,
        required: true,
      },
    },
  },
  plugins: [
    credentials({
      autoSignUp: true,
      providerId: "borderless",
      async callback(_ctx, parsed) {
        const response = await fetch(
          `${serverEnv.BORDERLESS_API_BASE}/api/auth/signin`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: parsed.email,
              password: parsed.password,
            }),
          },
        );

        const payload = (await response.json().catch(() => null)) as
          | BorderlessSignInSuccess
          | BorderlessSignInError
          | null;

        if (!response.ok) {
          const message =
            payload && "error" in payload
              ? (payload.error?.message ?? "")
              : "";
          mapBorderlessErrorStatus(response.status, message);
        }

        if (!isBorderlessSignInSuccess(payload)) {
          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Unexpected authentication response. Try again.",
          });
        }

        const borderlessUser = payload.data.user;
        const accessToken = payload.data.token.accessToken;
        const expiresIn =
          typeof payload.data.token.expiresIn === "number" &&
          payload.data.token.expiresIn > 0
            ? payload.data.token.expiresIn
            : 60 * 60 * 24;
        const name =
          borderlessUser.name || borderlessUser.username || "User";

        await registerOpaqueSession({
          accessToken,
          externalId: borderlessUser.id,
          email: borderlessUser.email,
          name,
          expiresIn,
        });

        return {
          email: borderlessUser.email,
          name,
          accessToken,
          externalId: borderlessUser.id,
        };
      },
    }),
    nextCookies(),
  ],
});
