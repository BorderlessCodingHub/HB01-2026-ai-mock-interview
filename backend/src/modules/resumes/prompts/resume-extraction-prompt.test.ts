import { describe, expect, it } from "vitest";

import {
  buildResumeExtractionPrompt,
  OUTPUT_FORMAT_SECTION_HEADER,
  RESUME_TEXT_SECTION_HEADER,
} from "@/modules/resumes/prompts/resume-extraction-prompt";

function outputFormatSection(prompt: string): string {
  const start = prompt.indexOf(OUTPUT_FORMAT_SECTION_HEADER);
  const end = prompt.indexOf(RESUME_TEXT_SECTION_HEADER);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return prompt.slice(start, end);
}

describe("buildResumeExtractionPrompt output format", () => {
  const section = outputFormatSection(
    buildResumeExtractionPrompt("Jane Doe\nSoftware Engineer"),
  );

  it("no longer claims empty values are stripped after extraction", () => {
    expect(section).not.toContain("stripped after extraction");
  });

  it("requires name and title, falling back to the most recent role", () => {
    expect(section).toContain(
      "personal_info.name and personal_info.title are required",
    );
    expect(section).toContain("use the role of the most recent experience");
  });

  it("asks to omit experiences and projects missing required fields", () => {
    expect(section).toContain(
      "Each experience needs a company and a role, and each project needs a name; omit entries that lack them.",
    );
  });

  it("forbids empty strings inside arrays", () => {
    expect(section).toContain('never include "" in an array');
  });

  it("only allows about and project description to be empty", () => {
    expect(section).toContain(
      'Only personal_info.about and project description may be ""',
    );
  });
});
