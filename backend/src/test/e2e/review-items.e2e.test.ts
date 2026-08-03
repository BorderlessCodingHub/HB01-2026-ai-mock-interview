import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import request from "supertest";
import type { Express } from "express";

import { createApp } from "@/config/app";
import prisma from "@/infrastructure/database";
import { ReviewPriority } from "../../../prisma/generated/client";
import {
  authHeader,
  seedAuthenticatedUser,
} from "@/test/helpers/auth-helpers";
import { seedReadyResume } from "@/test/helpers/interview-seed-helpers";
import { truncateTables } from "@/test/containers/truncate-tables";

async function authenticate(): Promise<{
  token: string;
  userId: number;
}> {
  const auth = await seedAuthenticatedUser();
  return {
    token: auth.accessToken,
    userId: auth.userId,
  };
}

async function seedReviewItem(
  userId: number,
  overrides: {
    topic: string;
    angle?: string;
    description: string;
    priority: (typeof ReviewPriority)[keyof typeof ReviewPriority];
    status?: "active" | "learned";
    learnedAt?: Date | null;
  },
) {
  const resume = await seedReadyResume(userId);
  const session = await prisma.interviewSession.create({
    data: {
      userId,
      resumeId: resume.id,
      level: "entry",
      interviewLocale: "en",
      maxTurns: 5,
    },
  });

  return prisma.reviewItem.create({
    data: {
      userId,
      sessionId: session.id,
      topic: overrides.topic,
      angle: overrides.angle ?? "general",
      description: overrides.description,
      priority: overrides.priority,
      status: overrides.status ?? "active",
      learnedAt: overrides.learnedAt ?? null,
    },
  });
}

describe("Review Items API E2E", () => {
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

  describe("GET /api/review-items/", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).get("/api/review-items/");

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 200 with empty reviewItems when user has none", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .get("/api/review-items/")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ reviewItems: [] });
    });

    it("does not return review items belonging to another user", async () => {
      const { userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const session = await prisma.interviewSession.create({
        data: {
          userId,
          resumeId: resume.id,
          level: "entry",
          interviewLocale: "en",
      maxTurns: 5,
        },
      });

      await prisma.reviewItem.create({
        data: {
          userId,
          sessionId: session.id,
          topic: "System Design",
          angle: "scalability trade-offs",
          description: "Practice scalability trade-offs.",
          priority: ReviewPriority.high,
        },
      });

      const other = await seedAuthenticatedUser({
        email: "other@example.com",
        name: "Other User",
      });

      const response = await request(app)
        .get("/api/review-items/")
        .set(authHeader(other.accessToken));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ reviewItems: [] });
    });

    it("returns 200 with review items for the authenticated user", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const session = await prisma.interviewSession.create({
        data: {
          userId,
          resumeId: resume.id,
          level: "entry",
          interviewLocale: "en",
      maxTurns: 5,
        },
      });

      await prisma.reviewItem.create({
        data: {
          userId,
          sessionId: session.id,
          topic: "System Design",
          angle: "scalability trade-offs",
          description: "Practice scalability trade-offs.",
          priority: ReviewPriority.high,
        },
      });

      await prisma.reviewItem.create({
        data: {
          userId,
          sessionId: session.id,
          topic: "TypeScript",
          angle: "generics and utility types",
          description: "Review generics and utility types.",
          priority: ReviewPriority.medium,
        },
      });

      const response = await request(app)
        .get("/api/review-items/")
        .set(authHeader(token));

      expect(response.status).toBe(200);
      expect(response.body.reviewItems).toHaveLength(2);
      expect(response.body.reviewItems[0]).toMatchObject({
        sessionId: session.id,
        topic: "System Design",
        priority: "high",
      });
      expect(response.body.reviewItems[1]).toMatchObject({
        topic: "TypeScript",
        priority: "medium",
      });
    });

    it("filters review items by status=active, learned, and all", async () => {
      const { token, userId } = await authenticate();
      const learnedAt = new Date("2026-06-01T12:00:00.000Z");

      await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
        status: "active",
      });
      await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Review generics and utility types.",
        priority: ReviewPriority.medium,
        status: "learned",
        learnedAt,
      });

      const activeResponse = await request(app)
        .get("/api/review-items/")
        .query({ status: "active" })
        .set(authHeader(token));

      expect(activeResponse.status).toBe(200);
      expect(activeResponse.body.reviewItems).toHaveLength(1);
      expect(activeResponse.body.reviewItems[0]).toMatchObject({
        topic: "System Design",
        status: "active",
      });

      const learnedResponse = await request(app)
        .get("/api/review-items/")
        .query({ status: "learned" })
        .set(authHeader(token));

      expect(learnedResponse.status).toBe(200);
      expect(learnedResponse.body.reviewItems).toHaveLength(1);
      expect(learnedResponse.body.reviewItems[0]).toMatchObject({
        topic: "TypeScript",
        status: "learned",
        learnedAt: learnedAt.toISOString(),
      });

      const allResponse = await request(app)
        .get("/api/review-items/")
        .query({ status: "all" })
        .set(authHeader(token));

      expect(allResponse.status).toBe(200);
      expect(allResponse.body.reviewItems).toHaveLength(2);
      expect(allResponse.body.reviewItems.map((item: { topic: string }) => item.topic)).toEqual(
        expect.arrayContaining(["System Design", "TypeScript"]),
      );
    });
  });

  describe("PATCH /api/review-items/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app)
        .patch(`/api/review-items/${randomUUID()}`)
        .send({ status: "learned" });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("marks an active review item as learned", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
        status: "active",
      });

      const response = await request(app)
        .patch(`/api/review-items/${item.id}`)
        .set(authHeader(token))
        .send({ status: "learned" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: item.id,
        status: "learned",
        learnedAt: expect.any(String),
      });

      const listResponse = await request(app)
        .get("/api/review-items/")
        .query({ status: "learned" })
        .set(authHeader(token));

      expect(listResponse.body.reviewItems).toHaveLength(1);
      expect(listResponse.body.reviewItems[0].id).toBe(item.id);
    });

    it("reactivates a learned review item", async () => {
      const { token, userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "TypeScript",
        description: "Review generics and utility types.",
        priority: ReviewPriority.medium,
        status: "learned",
        learnedAt: new Date("2026-06-01T12:00:00.000Z"),
      });

      const response = await request(app)
        .patch(`/api/review-items/${item.id}`)
        .set(authHeader(token))
        .send({ status: "active" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: item.id,
        status: "active",
        learnedAt: null,
      });

      const listResponse = await request(app)
        .get("/api/review-items/")
        .query({ status: "active" })
        .set(authHeader(token));

      expect(listResponse.body.reviewItems).toHaveLength(1);
      expect(listResponse.body.reviewItems[0].id).toBe(item.id);
    });

    it("returns 404 when review item does not exist", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .patch(`/api/review-items/${randomUUID()}`)
        .set(authHeader(token))
        .send({ status: "learned" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Review item not found" });
    });

    it("returns 404 when review item belongs to another user", async () => {
      const { userId } = await authenticate();
      const item = await seedReviewItem(userId, {
        topic: "System Design",
        description: "Practice scalability trade-offs.",
        priority: ReviewPriority.high,
      });

      const other = await seedAuthenticatedUser({
        email: "patch-other@example.com",
        name: "Patch Other User",
      });

      const response = await request(app)
        .patch(`/api/review-items/${item.id}`)
        .set(authHeader(other.accessToken))
        .send({ status: "learned" });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Review item not found" });
    });
  });

  describe("DELETE /api/review-items/:id", () => {
    it("returns 401 without authentication", async () => {
      const response = await request(app).delete(
        `/api/review-items/${randomUUID()}`,
      );

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        message: "Authentication required",
      });
    });

    it("returns 204 and removes the item for the owner", async () => {
      const { token, userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const session = await prisma.interviewSession.create({
        data: {
          userId,
          resumeId: resume.id,
          level: "entry",
          interviewLocale: "en",
      maxTurns: 5,
        },
      });

      const item = await prisma.reviewItem.create({
        data: {
          userId,
          sessionId: session.id,
          topic: "System Design",
          angle: "scalability trade-offs",
          description: "Practice scalability trade-offs.",
          priority: ReviewPriority.high,
        },
      });

      const deleteResponse = await request(app)
        .delete(`/api/review-items/${item.id}`)
        .set(authHeader(token));

      expect(deleteResponse.status).toBe(204);
      expect(deleteResponse.body).toEqual({});

      const listResponse = await request(app)
        .get("/api/review-items/")
        .set(authHeader(token));

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toEqual({ reviewItems: [] });

      const stored = await prisma.reviewItem.findUnique({
        where: { id: item.id },
      });
      expect(stored).toBeNull();
    });

    it("returns 404 when review item does not exist", async () => {
      const { token } = await authenticate();

      const response = await request(app)
        .delete(`/api/review-items/${randomUUID()}`)
        .set(authHeader(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Review item not found" });
    });

    it("returns 404 when review item belongs to another user", async () => {
      const { userId } = await authenticate();
      const resume = await seedReadyResume(userId);

      const session = await prisma.interviewSession.create({
        data: {
          userId,
          resumeId: resume.id,
          level: "entry",
          interviewLocale: "en",
      maxTurns: 5,
        },
      });

      const item = await prisma.reviewItem.create({
        data: {
          userId,
          sessionId: session.id,
          topic: "System Design",
          angle: "scalability trade-offs",
          description: "Practice scalability trade-offs.",
          priority: ReviewPriority.high,
        },
      });

      const other = await seedAuthenticatedUser({
        email: "other@example.com",
        name: "Other User",
      });

      const response = await request(app)
        .delete(`/api/review-items/${item.id}`)
        .set(authHeader(other.accessToken));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: "Review item not found" });

      const stored = await prisma.reviewItem.findUnique({
        where: { id: item.id },
      });
      expect(stored).not.toBeNull();
    });
  });
});
