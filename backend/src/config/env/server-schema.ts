import type { StandardSchemaV1 } from "@t3-oss/env-core";
import { z } from "zod";

/** Server-side environment variable validators (MVC, SMTP, rate limit). */
export const serverEnv = {
  // Database
  DATABASE_URL: z.string().min(1),

  // Server
  PORT: z.coerce.number().default(3000),
  /** One origin, or comma-separated origins (scheme+host, no path). */
  CORS_ORIGIN: z
    .string()
    .min(1)
    .refine(
      (value) =>
        value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .every((origin) => z.url().safeParse(origin).success),
      { message: "Invalid url" },
    ),
  /** Absolute frontend base URL (include /ai-mock-interview under labs). */
  FRONTEND_URL: z.url(),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX: z.coerce.number().default(20),
  RATE_LIMIT_AI_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_AI_MAX: z.coerce.number().default(60),

  // Token usage limits (monthly per user, UTC calendar month)
  TOKEN_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  TOKEN_LIMIT_MONTHLY_MAX: z.coerce.number().default(500_000),

  // OpenAI (mock interview)
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL_INTERVIEW: z.string().default("gpt-5"),
  OPENAI_MODEL_EXTRACTION: z.string().default("gpt-5-nano"),
  OPENAI_MODEL_REVIEW: z.string().default("gpt-5-nano"),

  // AssemblyAI (speech-to-text)
  ASSEMBLYAI_API_KEY: z.string().min(1),

  // Review sessions
  REVIEW_SESSION_QUESTION_COUNT: z.coerce.number().default(3),

  // Cloudflare R2 (object storage)
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET_NAME: z.string().min(1),
  R2_ENDPOINT: z.string().url().optional(),

  // Redis (BullMQ + Borderless opaque session store)
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Server-to-server sync of Borderless opaque access tokens (Next.js → Express)
  INTERNAL_AUTH_SYNC_SECRET: z.string().min(32),

  // Résumé uploads
  RESUME_MAX_BYTES: z.coerce.number().default(5_242_880), // 5 MB

  // Transcription uploads
  TRANSCRIBE_MAX_BYTES: z.coerce.number().default(5_242_880), // 5 MB
} as const;

export const serverEnvSchema = z.object(serverEnv).transform((data) => ({
  ...data,
  R2_ENDPOINT:
    data.R2_ENDPOINT ??
    `https://${data.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
}));

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function formatEnvValidationIssues(
  issues: readonly StandardSchemaV1.Issue[],
): string {
  const lines = issues.map((issue) => {
    const path = issue.path?.map(String).join(".") || "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `Invalid environment variables:\n${lines.join("\n")}`;
}
