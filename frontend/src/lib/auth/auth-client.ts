import { createAuthClient } from "better-auth/react";
import { credentialsClient } from "better-auth-credentials-plugin/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

import type { auth } from "./auth";

/**
 * Public Next.js basePath, inlined from next.config `env` at build time.
 * Labs serves the app under `/ai-mock-interview`; without it the client posts
 * to `/api/auth` on the domain root and the Worker never receives the request.
 * Local dev has no basePath, so this stays `/api/auth`.
 *
 * Borderless is still called server-side from `auth.ts` — this path is only
 * the Next.js better-auth handler.
 */
const appBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const authClient = createAuthClient({
  basePath: `${appBasePath}/api/auth`,
  plugins: [credentialsClient(), inferAdditionalFields<typeof auth>()],
});
