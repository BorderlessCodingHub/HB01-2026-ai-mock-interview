import { createAuthClient } from "better-auth/react";
import { credentialsClient } from "better-auth-credentials-plugin/client";
import { inferAdditionalFields } from "better-auth/client/plugins";

import type { auth } from "./auth";

/** Must include Next `basePath` so /api/auth is not requested at domain root. */
const AUTH_BASE_PATH = "/ai-mock-interview/api/auth";

export const authClient = createAuthClient({
  basePath: AUTH_BASE_PATH,
  plugins: [credentialsClient(), inferAdditionalFields<typeof auth>()],
});
