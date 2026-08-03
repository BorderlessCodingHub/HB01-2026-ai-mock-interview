import { describe, expect, it } from "vitest";

import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";

import {
  PRIOR_COVERAGE_SECTION_HEADER,
  buildInterviewerSystemPrompt,
  buildPriorCoverageSoftGuidanceBlock,
} from "./interviewer-system-prompt";

const minimalResume: StructuredSummary = {
  personal_info: {
    name: "Jane Doe",
    title: "Software Engineer",
    about: "",
  },
  skills: [],
  experiences: [],
  projects: [],
  certifications: [],
};

const basePromptParams = {
  level: "mid" as const,
  resumeSummary: minimalResume,
};

describe("buildPriorCoverageSoftGuidanceBlock", () => {
  it("returns null when both coverage and review lists are empty", () => {
    expect(
      buildPriorCoverageSoftGuidanceBlock({
        recentCoverage: [],
        activeReviewTopics: [],
      }),
    ).toBeNull();
    expect(buildPriorCoverageSoftGuidanceBlock({})).toBeNull();
  });

  it("renders only recent coverage when active reviews are empty", () => {
    const block = buildPriorCoverageSoftGuidanceBlock({
      recentCoverage: [{ topic: "React", angle: "hooks lifecycle" }],
      activeReviewTopics: [],
    });

    expect(block).not.toBeNull();
    expect(block).toContain(PRIOR_COVERAGE_SECTION_HEADER);
    expect(block).toContain("React");
    expect(block).toContain("hooks lifecycle");
    expect(block).toContain("Recent coverage:");
    expect(block).not.toContain("Active review topics:\n-");
  });

  it("renders only active reviews when recent coverage is empty", () => {
    const block = buildPriorCoverageSoftGuidanceBlock({
      recentCoverage: [],
      activeReviewTopics: [
        { topic: "Databases", priority: "high", description: "Indexing gaps" },
      ],
    });

    expect(block).not.toBeNull();
    expect(block).toContain(PRIOR_COVERAGE_SECTION_HEADER);
    expect(block).toContain("Databases");
    expect(block).toContain("high");
    expect(block).toContain("Indexing gaps");
    expect(block).toContain("Active review topics:");
    expect(block).not.toContain("Recent coverage:\n-");
  });

  it("includes normative soft-guidance instructions", () => {
    const block = buildPriorCoverageSoftGuidanceBlock({
      recentCoverage: [{ topic: "Go", angle: "concurrency" }],
      activeReviewTopics: [{ topic: "System design", priority: "medium" }],
    });

    expect(block).toContain("same topic");
    expect(block).toContain("same angle");
    expect(block).toMatch(/different angle/i);
    expect(block).toMatch(/lower priority/i);
    expect(block).toMatch(/Study/i);
    expect(block).toMatch(/natural interview/i);
    expect(block).toMatch(/guidance, not a script/i);
  });

  it("truncates review descriptions to about 120 characters", () => {
    const longDescription = "x".repeat(150);
    const block = buildPriorCoverageSoftGuidanceBlock({
      activeReviewTopics: [
        { topic: "Networking", priority: "low", description: longDescription },
      ],
    });

    expect(block).not.toBeNull();
    expect(block).not.toContain(longDescription);
    const descriptionLine = block!
      .split("\n")
      .find((line) => line.includes("Networking"))!;
    const visibleDescription = descriptionLine.replace(/^.*—\s*/, "");
    expect(visibleDescription.length).toBeLessThanOrEqual(120);
    expect(visibleDescription.endsWith("...")).toBe(true);
  });
});

describe("buildInterviewerSystemPrompt soft coverage integration", () => {
  it("omits the soft-coverage section when both lists are absent", () => {
    const prompt = buildInterviewerSystemPrompt(basePromptParams);

    expect(prompt).not.toContain(PRIOR_COVERAGE_SECTION_HEADER);
  });

  it("includes the soft-coverage section when hints are provided", () => {
    const prompt = buildInterviewerSystemPrompt({
      ...basePromptParams,
      recentCoverage: [{ topic: "TypeScript", angle: "generics" }],
    });

    expect(prompt).toContain(PRIOR_COVERAGE_SECTION_HEADER);
    expect(prompt).toContain("TypeScript");
  });
});
