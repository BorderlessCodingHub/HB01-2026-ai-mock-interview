import { createAuthClient } from "better-auth/react";
import { credentialsClient } from "better-auth-credentials-plugin/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

import type { auth } from "./auth";

/**
 * Next.js inlines `basePath` here at build time. Labs serves the app under
 * `/ai-mock-interview`; without it the client posts to `/api/auth` on the
 * domain root and production returns 404.
 */
const nextBasePath = process.env.__NEXT_ROUTER_BASEPATH ?? "";

export const authClient = createAuthClient({
  basePath: `${nextBasePath}/api/auth`,
  plugins: [credentialsClient(), inferAdditionalFields<typeof auth>()],
});
