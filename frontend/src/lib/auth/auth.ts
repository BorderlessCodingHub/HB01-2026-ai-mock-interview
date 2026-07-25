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

export const auth = betterAuth({
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: serverEnv.BETTER_AUTH_URL,
  // Isolate cookies from other labs apps on labs.borderlesscoding.com
  advanced: {
    cookiePrefix: "ami",
  },
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

        const success = payload as BorderlessSignInSuccess;
        const borderlessUser = success.data.user;
        const accessToken = success.data.token.accessToken;

        return {
          email: borderlessUser.email,
          name: borderlessUser.name || borderlessUser.username || "User",
          accessToken,
          externalId: borderlessUser.id,
        };
      },
    }),
    nextCookies(),
  ],
});
