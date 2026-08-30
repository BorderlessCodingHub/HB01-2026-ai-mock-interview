import { afterAll, afterEach, describe, expect, it } from "vitest";
import prisma from "@/infrastructure/database";
import { disconnectDatabase, resetDatabase } from "@/test/integration/helpers";
import { UserRepository } from "@/modules/auth/repository/user-repository";
import { ResumeRepository } from "./resume-repository";

const structuredSummary = {
  personal_info: { name: "Jane Doe", title: "Engineer", about: "" },
  skills: ["TypeScript", "Node.js"],
  experiences: [
    {
      company: "Acme",
      role: "Developer",
      highlights: ["Built APIs"],
    },
  ],
  projects: [
    {
      name: "Portfolio",
      description: "",
      technologies: [],
      highlights: [],
    },
  ],
  certifications: [],
};

describe("ResumeRepository (integration)", () => {
  const userRepository = new UserRepository();
  const repository = new ResumeRepository();

  async function createTestUser() {
    return userRepository.create({
      name: "Resume Owner",
      email: `resume-owner-${crypto.randomUUID()}@example.com`,
      password: "$2b$10$hashedpasswordplaceholderfortests",
    });
  }

  afterEach(() => resetDatabase());
  afterAll(() => disconnectDatabase());

  it("createProcessing inserts a processing resume for the user", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();

    const created = await repository.createProcessing(
      user.id,
      "Jane Doe CV.pdf",
      `users/${user.id}/resumes/${resumeId}.pdf`,
      "pdf",
      resumeId,
    );

    expect(created).toMatchObject({
      id: resumeId,
      userId: user.id,
      name: "Jane Doe CV.pdf",
      status: "processing",
      sourceFormat: "pdf",
      structuredSummary: null,
      rawText: null,
      errorMessage: null,
    });
  });

  it("createProcessing persists a tex sourceFormat", async () => {
    const user = await createTestUser();

    const created = await repository.createProcessing(
      user.id,
      "CV.tex",
      "storage-key-tex",
      "tex",
    );

    expect(created.sourceFormat).toBe("tex");
  });

  it("createProcessing accepts an optional id", async () => {
    const user = await createTestUser();
    const explicitId = crypto.randomUUID();

    const created = await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      explicitId,
    );

    expect(created.id).toBe(explicitId);
  });

  it("findById loads a resume by id", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();
    const created = await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );

    const found = await repository.findById(resumeId);

    expect(found).toMatchObject({
      id: created.id,
      userId: user.id,
      name: created.name,
    });
  });

  it("findById returns null when resume does not exist", async () => {
    const found = await repository.findById(crypto.randomUUID());

    expect(found).toBeNull();
  });

  it("findByIdAndUserId returns null when resume does not exist", async () => {
    const user = await createTestUser();

    const found = await repository.findByIdAndUserId(
      crypto.randomUUID(),
      user.id,
    );

    expect(found).toBeNull();
  });

  it("findByIdAndUserId returns resume owned by the user", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();
    await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );

    const found = await repository.findByIdAndUserId(resumeId, user.id);

    expect(found).toMatchObject({ id: resumeId, userId: user.id });
  });

  it("findByIdAndUserId returns null when resume is not owned", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const resumeId = crypto.randomUUID();
    await repository.createProcessing(
      owner.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );

    const found = await repository.findByIdAndUserId(resumeId, other.id);

    expect(found).toBeNull();
  });

  it("updateReady rejects invalid structured summary before persisting", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();
    await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );

    await expect(
      repository.updateReady(
        resumeId,
        { personal_info: { name: "Jane" } },
        "text",
      ),
    ).rejects.toThrow();

    const unchanged = await repository.findById(resumeId);
    expect(unchanged?.status).toBe("processing");
  });

  it("updateReady sets structured summary, raw text, and ready status", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();
    await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );
    const rawText = "Jane Doe\nSoftware Engineer";

    const updated = await repository.updateReady(
      resumeId,
      structuredSummary,
      rawText,
    );

    expect(updated).toMatchObject({
      id: resumeId,
      status: "ready",
      rawText,
      errorMessage: null,
    });
    expect(updated.structuredSummary).toEqual(structuredSummary);

    const reloaded = await repository.findById(resumeId);
    expect(reloaded?.status).toBe("ready");
  });

  it("updateFailed sets failed status and error message", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();
    await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );
    const errorMessage = "PDF extraction failed";

    const updated = await repository.updateFailed(resumeId, errorMessage);

    expect(updated).toMatchObject({
      id: resumeId,
      status: "failed",
      errorMessage,
    });
  });

  it("deleteByIdAndUserId removes only the resume and nulls session.resumeId", async () => {
    const user = await createTestUser();
    const resumeId = crypto.randomUUID();
    await repository.createProcessing(
      user.id,
      "CV.pdf",
      "storage-key",
      "pdf",
      resumeId,
    );

    const session = await prisma.interviewSession.create({
      data: {
        userId: user.id,
        resumeId,
        level: "entry",
        interviewLocale: "en",
        maxTurns: 5,
      },
    });

    const deleted = await repository.deleteByIdAndUserId(resumeId, user.id);

    expect(deleted?.id).toBe(resumeId);
    expect(await prisma.resume.findUnique({ where: { id: resumeId } })).toBeNull();

    const survivingSession = await prisma.interviewSession.findUnique({
      where: { id: session.id },
    });
    expect(survivingSession).toMatchObject({
      id: session.id,
      userId: user.id,
      resumeId: null,
    });
  });
});
