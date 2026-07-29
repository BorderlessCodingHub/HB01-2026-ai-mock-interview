import type { IBorderlessSessionStore } from "@/modules/auth/protocols/borderless-session-store";
import type { Request, Response } from "express";

const DEFAULT_TTL_SECONDS = 60 * 60 * 24; // 24h

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

export class BorderlessSessionController {
  constructor(
    private readonly sessionStore: IBorderlessSessionStore,
    private readonly internalSecret: string,
  ) {}

  register = async (req: Request, res: Response): Promise<void> => {
    const secret = req.headers["x-internal-auth-secret"];
    if (typeof secret !== "string" || secret !== this.internalSecret) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    const body = req.body as {
      accessToken?: unknown;
      externalId?: unknown;
      email?: unknown;
      name?: unknown;
      expiresIn?: unknown;
    };

    const accessToken =
      typeof body.accessToken === "string" ? body.accessToken.trim() : "";
    const externalId =
      typeof body.externalId === "string" ? body.externalId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const name =
      typeof body.name === "string" && body.name.trim().length > 0
        ? body.name.trim()
        : email.split("@")[0] || "User";

    if (!accessToken || !externalId || !email) {
      res.status(400).json({
        message: "accessToken, externalId, and email are required",
      });
      return;
    }

    const expiresIn =
      typeof body.expiresIn === "number" &&
      Number.isFinite(body.expiresIn) &&
      body.expiresIn > 0
        ? Math.floor(body.expiresIn)
        : DEFAULT_TTL_SECONDS;

    const exp = Math.floor(Date.now() / 1000) + expiresIn;

    await this.sessionStore.save(
      accessToken,
      { externalId, email, name, exp },
      expiresIn,
    );

    res.status(204).send();
  };

  invalidate = async (req: Request, res: Response): Promise<void> => {
    const token =
      extractBearerToken(req.headers.authorization) ??
      (typeof req.body?.accessToken === "string"
        ? req.body.accessToken.trim()
        : "");

    if (!token) {
      res.status(400).json({ message: "accessToken is required" });
      return;
    }

    await this.sessionStore.delete(token);
    res.status(204).send();
  };
}
