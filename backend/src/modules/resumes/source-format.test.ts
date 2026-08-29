import { describe, expect, it } from "vitest";

import {
  classifyResumeSourceFormat,
  resumeContentType,
  resumeStorageKey,
} from "./source-format";

describe("classifyResumeSourceFormat", () => {
  it("classifies a .pdf suffix as pdf", () => {
    expect(classifyResumeSourceFormat("resume.pdf")).toBe("pdf");
  });

  it("classifies a .tex suffix as tex", () => {
    expect(classifyResumeSourceFormat("resume.tex")).toBe("tex");
  });

  it("classifies CV.TEX as tex", () => {
    expect(classifyResumeSourceFormat("CV.TEX")).toBe("tex");
  });

  it("classifies cv.TeX as tex", () => {
    expect(classifyResumeSourceFormat("cv.TeX")).toBe("tex");
  });

  it("returns null for notes.txt", () => {
    expect(classifyResumeSourceFormat("notes.txt")).toBeNull();
  });

  it("classifies a name ending with .pdf as pdf", () => {
    expect(classifyResumeSourceFormat("my-cv.final.pdf")).toBe("pdf");
  });
});

describe("resumeStorageKey", () => {
  it("builds a pdf key as users/{userId}/resumes/{resumeId}.pdf", () => {
    expect(resumeStorageKey(42, "abc-123", "pdf")).toBe(
      "users/42/resumes/abc-123.pdf",
    );
  });

  it("builds a tex key as users/{userId}/resumes/{resumeId}.tex", () => {
    expect(resumeStorageKey(42, "abc-123", "tex")).toBe(
      "users/42/resumes/abc-123.tex",
    );
  });
});

describe("resumeContentType", () => {
  it("returns application/pdf for pdf", () => {
    expect(resumeContentType("pdf")).toBe("application/pdf");
  });

  it("returns text/x-tex for tex", () => {
    expect(resumeContentType("tex")).toBe("text/x-tex");
  });
});
