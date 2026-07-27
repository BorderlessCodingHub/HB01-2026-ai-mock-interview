import type { IBorderlessTokenVerifier } from "../protocols/borderless-token-verifier";
import type { UserSyncService } from "../service/user-sync-service";
import type { RequestHandler } from "express";

export type PublicRoute = {
  method: string;
  path: string;
};

export const PUBLIC_ROUTES: PublicRoute[] = [
  { method: "GET", path: "/" },
  { method: "GET", path: "/health" },
  { method: "GET", path: "/health/ready" },
  { method: "POST", path: "/internal/borderless-sessions" },
  { method: "DELETE", path: "/internal/borderless-sessions" },
];

function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => route.method === method && route.path === path,
  );
}

function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function makeCheckAuthMiddleware(
  verifier: IBorderlessTokenVerifier,
  userSync: UserSyncService,
): RequestHandler {
  return (req, res, next) => {
    if (isPublicRoute(req.method, req.path)) {
      next();
      return;
    }

    const token = extractBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    void (async () => {
      try {
        const claims = await verifier.verify(token);
        const user = await userSync.resolveLocalUser(claims);
        req.userId = user.id;
        next();
      } catch {
        res.status(401).json({ message: "Invalid or expired token" });
      }
    })();
  };
}
