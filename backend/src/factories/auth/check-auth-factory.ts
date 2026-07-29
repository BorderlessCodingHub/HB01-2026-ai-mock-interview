import type Redis from "ioredis";
import type { RequestHandler } from "express";

import { env } from "@/config/env";
import { redisConnection } from "@/infrastructure/queue/resume-queue";
import { RedisBorderlessSessionStore } from "@/modules/auth/adapters/borderless-session-store";
import { BorderlessTokenResolver } from "@/modules/auth/adapters/borderless-token-resolver";
import { BorderlessSessionController } from "@/modules/auth/controller/borderless-session-controller";
import { makeCheckAuthMiddleware } from "@/modules/auth/middlewares/check-auth-middleware";
import { UserRepository } from "@/modules/auth/repository/user-repository";
import { UserSyncService } from "@/modules/auth/service/user-sync-service";

function getSessionStore(): RedisBorderlessSessionStore {
  return new RedisBorderlessSessionStore(redisConnection as Redis);
}

export function makeCheckAuth(): RequestHandler {
  const verifier = new BorderlessTokenResolver(getSessionStore());
  const userSync = new UserSyncService(new UserRepository());

  return makeCheckAuthMiddleware(verifier, userSync);
}

export function makeBorderlessSessionController(): BorderlessSessionController {
  return new BorderlessSessionController(
    getSessionStore(),
    env.INTERNAL_AUTH_SYNC_SECRET,
  );
}
