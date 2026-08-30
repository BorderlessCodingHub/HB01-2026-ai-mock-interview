import {
  resumeContentType,
  type ResumeSourceFormat,
} from "./source-format";

export type ResumeFileHeaderInput = {
  sourceFormat: ResumeSourceFormat;
  name: string;
  byteLength: number;
};

export type ResumeFileHeaders = {
  contentType: string;
  contentDisposition: string;
  contentLength: string;
  cacheControl: string;
};

function asciiFilenameFallback(
  name: string,
  sourceFormat: ResumeSourceFormat,
): string {
  const sanitized = name
    .replace(/["\\\r\n]/g, "")
    .replace(/[^\x20-\x7E]/g, "");

  if (sanitized.length === 0) {
    return sourceFormat === "pdf" ? "resume.pdf" : "resume.tex";
  }

  return sanitized;
}

export function buildResumeFileHeaders(
  input: ResumeFileHeaderInput,
): ResumeFileHeaders {
  const dispositionType = input.sourceFormat === "pdf" ? "inline" : "attachment";
  const fallback = asciiFilenameFallback(input.name, input.sourceFormat);

  return {
    contentType: resumeContentType(input.sourceFormat),
    contentDisposition: `${dispositionType}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(input.name)}`,
    contentLength: String(input.byteLength),
    cacheControl: "private, no-store",
  };
}
