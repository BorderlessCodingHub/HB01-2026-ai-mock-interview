export const RESUME_SOURCE_FORMATS = ["pdf", "tex"] as const;
export type ResumeSourceFormat = (typeof RESUME_SOURCE_FORMATS)[number];

export function classifyResumeSourceFormat(
  originalname: string,
): ResumeSourceFormat | null {
  const name = originalname.toLowerCase();

  if (name.endsWith(".tex")) {
    return "tex";
  }

  if (name.endsWith(".pdf")) {
    return "pdf";
  }

  return null;
}

export function resumeStorageKey(
  userId: number,
  resumeId: string,
  format: ResumeSourceFormat,
): string {
  return `users/${userId}/resumes/${resumeId}.${format}`;
}

export function resumeContentType(format: ResumeSourceFormat): string {
  if (format === "pdf") {
    return "application/pdf";
  }

  return "text/x-tex";
}
