import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/** Server-only env for better-auth / Borderless (not exposed to the browser). */
export const serverEnv = createEnv({
  server: {
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url().default("http://localhost:3001"),
    BORDERLESS_API_BASE: z.url().default("https://api.borderlesscoding.com"),
    /** HS256 key for Hone access tokens; must equal the API's HONE_JWT_SECRET. */
    HONE_JWT_SECRET: z.string().min(32),
  },
  experimental__runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
