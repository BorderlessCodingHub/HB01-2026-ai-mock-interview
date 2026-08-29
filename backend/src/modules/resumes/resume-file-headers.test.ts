import { describe, expect, it } from "vitest";

import { buildResumeFileHeaders } from "./resume-file-headers";

describe("buildResumeFileHeaders", () => {
  it("returns application/pdf and inline disposition including the name for pdf", () => {
    const headers = buildResumeFileHeaders({
      sourceFormat: "pdf",
      name: "my-resume.pdf",
      byteLength: 1024,
    });

    expect(headers.contentType).toBe("application/pdf");
    expect(headers.contentDisposition).toContain("inline");
    expect(headers.contentDisposition).toContain("my-resume.pdf");
  });

  it("returns text/x-tex and attachment disposition including the name for tex", () => {
    const headers = buildResumeFileHeaders({
      sourceFormat: "tex",
      name: "cv.tex",
      byteLength: 512,
    });

    expect(headers.contentType).toBe("text/x-tex");
    expect(headers.contentDisposition).toContain("attachment");
    expect(headers.contentDisposition).toContain("cv.tex");
  });

  it("sets cacheControl to private, no-store and contentLength to byteLength", () => {
    const headers = buildResumeFileHeaders({
      sourceFormat: "pdf",
      name: "resume.pdf",
      byteLength: 4096,
    });

    expect(headers.cacheControl).toBe("private, no-store");
    expect(Number(headers.contentLength)).toBe(4096);
    expect(String(headers.contentLength)).toBe("4096");
  });

  it("does not allow quotes, CR, LF, or backslash in the name to inject extra headers", () => {
    const headers = buildResumeFileHeaders({
      sourceFormat: "pdf",
      name: 'evil.pdf"\r\nX-Injected: true\\',
      byteLength: 100,
    });

    expect(headers.contentDisposition).not.toContain("\r");
    expect(headers.contentDisposition).not.toContain("\n");
  });

  it("uses RFC 5987 filename* with percent-encoding for a non-ASCII name", () => {
    const name = "currículo.pdf";
    const headers = buildResumeFileHeaders({
      sourceFormat: "pdf",
      name,
      byteLength: 200,
    });

    expect(headers.contentDisposition).toContain(
      `filename*=UTF-8''${encodeURIComponent(name)}`,
    );
  });

  it("uses a generic ASCII filename fallback when sanitization leaves the name empty", () => {
    const headers = buildResumeFileHeaders({
      sourceFormat: "pdf",
      name: "简历",
      byteLength: 50,
    });

    expect(headers.contentDisposition).toContain('filename="resume.pdf"');
    expect(headers.contentDisposition).toContain(
      `filename*=UTF-8''${encodeURIComponent("简历")}`,
    );
  });
});
