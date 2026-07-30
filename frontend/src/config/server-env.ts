import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Server-only env for better-auth / Borderless (not exposed to the browser). */
export const serverEnv = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    // Full better-auth mount (app basePath + /api/auth). Path in URL is used as
    // basePath and must NOT stop at /ai-mock-interview alone — withPath skips
    // appending /api/auth when the URL already has a pathname.
    BETTER_AUTH_URL: z
      .url()
      .default("http://localhost:3001/ai-mock-interview/api/auth"),
    BORDERLESS_API_BASE: z.url().default("https://api.borderlesscoding.com"),
    /** Express base URL for server-to-server session sync (opaque Borderless tokens). */
    SERVER_INTERNAL_URL: z.url().default("http://localhost:3000"),
    INTERNAL_AUTH_SYNC_SECRET: z.string().min(32),
  },
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
