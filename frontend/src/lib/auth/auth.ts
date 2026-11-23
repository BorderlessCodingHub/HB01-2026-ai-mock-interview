import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { APIError } from "better-auth/api";
import { credentials } from "better-auth-credentials-plugin";
import { SignJWT } from "jose";

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

/** Public app URL (cookies, trusted origins). */
function authAppOrigin(): string {
  return new URL(serverEnv.BETTER_AUTH_URL).origin;
}

/**
 * better-auth route matching runs on the path Next/OpenNext pass to the handler
 * (basePath stripped). Client still calls the public subpath via authClient.
 * @see https://github.com/better-auth/better-auth/issues/4715
 */
function betterAuthHandlerBaseURL(): string {
  return `${authAppOrigin()}/api/auth`;
}

/** Must match HONE_JWT_ISSUER / HONE_JWT_AUDIENCE in the Express API. */
const HONE_JWT_ISSUER = "hone-web";
const HONE_JWT_AUDIENCE = "hone-api";
const MAX_TOKEN_TTL_SECONDS = 60 * 60 * 24;

/**
 * Mints the Hone access token after Borderless accepted the credentials.
 * The Borderless token itself never leaves this server.
 */
async function mintHoneAccessToken(params: {
  externalId: string;
  email: string;
  name: string;
  expiresIn: number;
}): Promise<string> {
  const ttl = Math.min(Math.floor(params.expiresIn), MAX_TOKEN_TTL_SECONDS);
  return new SignJWT({ email: params.email, name: params.name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.externalId)
    .setIssuer(HONE_JWT_ISSUER)
    .setAudience(HONE_JWT_AUDIENCE)
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(new TextEncoder().encode(serverEnv.HONE_JWT_SECRET));
}

export const auth = betterAuth({
  database: undefined,
  secret: serverEnv.BETTER_AUTH_SECRET,
  baseURL: betterAuthHandlerBaseURL(),
  trustedOrigins: [
    "https://labs.borderlesscoding.com",
    "http://localhost:3001",
  ],
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

        const accessToken = await mintHoneAccessToken({
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
