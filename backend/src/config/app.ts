import { env } from "@/config/env";
import { setupSwagger } from "@/docs/setup-swagger";
import { errorHandler } from "@/shared/middlewares/error-handler-middleware";
import cors from "cors";
import express, { type Express } from "express";

import { setup as setupCheckpointer } from "@/infrastructure/ai/checkpoint/postgres-checkpointer";
import { pingDatabase } from "@/infrastructure/database/health";
import { pingRedis } from "@/infrastructure/queue/redis-health";
import {
  makeBorderlessSessionController,
  makeCheckAuth,
} from "@/factories/auth/check-auth-factory";
import { asyncHandler } from "@/shared";
import { setupRoutes } from "./routes";

const READY_CHECK_TIMEOUT_MS = 2000;

function parseCorsOrigins(value: string): string | string[] {
  const origins = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return origins.length === 1 ? origins[0]! : origins;
}

type CheckStatus = "ok" | "error";

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Health check timed out")), timeoutMs);
    }),
  ]);
}

async function checkDependency(
  check: () => Promise<void>,
): Promise<CheckStatus> {
  try {
    await withTimeout(check(), READY_CHECK_TIMEOUT_MS);
    return "ok";
  } catch {
    return "error";
  }
}

export async function createApp(): Promise<Express> {
  await setupCheckpointer();

  const app = express();

  app.use(
    cors({
      origin: parseCorsOrigins(env.CORS_ORIGIN),
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-Internal-Auth-Secret",
      ],
      credentials: true,
    }),
  );

  app.use(express.json());
  setupSwagger(app);
  app.use(makeCheckAuth());

  const borderlessSessions = makeBorderlessSessionController();
  app.post(
    "/internal/borderless-sessions",
    asyncHandler(borderlessSessions.register),
  );
  app.delete(
    "/internal/borderless-sessions",
    asyncHandler(borderlessSessions.invalidate),
  );

  await setupRoutes(app);

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.get("/health/ready", async (_req, res) => {
    const [database, redis] = await Promise.all([
      checkDependency(pingDatabase),
      checkDependency(pingRedis),
    ]);

    const checks = { database, redis };
    const allOk = database === "ok" && redis === "ok";

    res.status(allOk ? 200 : 503).json({
      status: allOk ? "ok" : "error",
      checks,
    });
  });

  app.get("/", (_req, res) => {
    res.status(200).send("OK");
  });

  app.use((_req, res) => {
    res.status(404).json({ message: "Not Found" });
  });

  app.use(errorHandler);

  return app;
}
