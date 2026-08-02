import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import request from "supertest";
import type { Express } from "express";

import { createApp } from "@/config/app";
import prisma from "@/infrastructure/database";
import {
  authHeader,
  seedAuthenticatedUser,
  signBorderlessAccessToken,
} from "@/test/helpers/auth-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

describe("Auth API E2E (Borderless Bearer)", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  beforeEach(async () => {
    await truncateTables();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns OK on health endpoint", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);
    expect(response.text).toBe("OK");
  });

  it("returns 401 for protected path without bearer token", async () => {
    const response = await request(app).get("/api/protected-smoke");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  it("returns 401 for protected path with malformed Authorization header", async () => {
    const response = await request(app)
      .get("/api/protected-smoke")
      .set("Authorization", "Token xyz");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication required",
    });
  });

  it("returns 401 for protected path with invalid bearer token", async () => {
    const response = await request(app)
      .get("/api/protected-smoke")
      .set("Authorization", "Bearer not-a-jwt");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      message: "Invalid or expired token",
    });
  });

  it("allows bearer auth to reach protected path and then returns 404", async () => {
    const auth = await seedAuthenticatedUser();

    const response = await request(app)
      .get("/api/protected-smoke")
      .set(authHeader(auth.accessToken));

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      message: "Not Found",
    });
  });

  it("upserts local user when token is valid but user row is missing", async () => {
    const externalId = `ext-${crypto.randomUUID()}`;
    const email = `upsert-${crypto.randomUUID()}@example.com`;
    const token = signBorderlessAccessToken({
      externalId,
      email,
      name: "Upsert Me",
    });

    const response = await request(app)
      .get("/api/protected-smoke")
      .set(authHeader(token));

    expect(response.status).toBe(404);

    const user = await prisma.user.findUnique({ where: { externalId } });
    expect(user).toMatchObject({
      externalId,
      email,
      name: "Upsert Me",
    });
  });

  it("former local auth routes are not mounted", async () => {
    const auth = await seedAuthenticatedUser();

    for (const path of [
      "/api/auth/signup",
      "/api/auth/login",
      "/api/auth/refresh",
      "/api/auth/request-password-reset",
      "/api/auth/reset-password",
    ]) {
      // Global checkAuth runs before the 404 handler; authenticate so we
      // assert the routes are absent rather than blocked as unauthenticated.
      const response = await request(app)
        .post(path)
        .set(authHeader(auth.accessToken))
        .send({});
      expect(response.status).toBe(404);
    }
  });

  it("serves OpenAPI without local auth paths", async () => {
    const response = await request(app).get("/api-docs.json");

    expect(response.status).toBe(200);
    expect(response.body.paths?.["/api/auth/login"]).toBeUndefined();
    expect(response.body.paths?.["/api/auth/signup"]).toBeUndefined();
  });
});
