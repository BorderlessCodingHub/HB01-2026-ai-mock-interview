import { describe, expect, it } from "vitest";

import { TOPIC_COVERAGE_MAX_PER_SESSION } from "@/modules/interview/constants/topic-coverage";
import {
  buildTopicCoverageGeneratorPrompt,
  INSTRUCTIONS_SECTION_HEADER,
  TRANSCRIPT_SECTION_HEADER,
} from "@/modules/interview/prompts/topic-coverage-generator-prompt";
import { LANGUAGE_SECTION_HEADER } from "@/shared/interview-locale/interview-locale";

const sampleTranscript =
  "Human: How do you handle caching?\nAI: What trade-offs did you consider?";

describe("buildTopicCoverageGeneratorPrompt", () => {
  const baseParams = {
    transcript: sampleTranscript,
  };

  it("includes the interview transcript", () => {
    const prompt = buildTopicCoverageGeneratorPrompt(baseParams);

    expect(prompt).toContain(TRANSCRIPT_SECTION_HEADER);
    expect(prompt).toContain(sampleTranscript);
  });

  it("instructs max topic+angle pairs and not inventing undiscussed topics", () => {
    const prompt = buildTopicCoverageGeneratorPrompt(baseParams);

    expect(prompt).toContain(String(TOPIC_COVERAGE_MAX_PER_SESSION));
    expect(prompt).toMatch(/topic.*angle|angle.*topic/i);
    expect(prompt).toMatch(/do not invent|not invent|not discussed/i);
  });

  it("instructs specific concise angles with longer text only when needed", () => {
    const prompt = buildTopicCoverageGeneratorPrompt(baseParams);

    expect(prompt).toMatch(/specific.*concise|concise.*specific/i);
    expect(prompt).toMatch(/longer description only when needed|only when needed/i);
    expect(prompt).toMatch(/vague|overview|discussion/i);
  });

  it("requires English topic and angle labels regardless of transcript language", () => {
    const prompt = buildTopicCoverageGeneratorPrompt(baseParams);

    expect(prompt).toMatch(/Always write topic and angle in English only/i);
    expect(prompt).toMatch(/internal labels|English system prompt/i);
    expect(prompt).not.toContain(LANGUAGE_SECTION_HEADER);
    expect(prompt.indexOf(INSTRUCTIONS_SECTION_HEADER)).toBeGreaterThan(-1);
  });

  it("ends with instructions when job description is present", () => {
    const prompt = buildTopicCoverageGeneratorPrompt({
      ...baseParams,
      jobDescription: "Senior backend engineer",
    });

    expect(prompt).toContain("Senior backend engineer");
    expect(prompt).not.toContain(LANGUAGE_SECTION_HEADER);
    expect(prompt.includes(INSTRUCTIONS_SECTION_HEADER)).toBe(true);
  });
});
