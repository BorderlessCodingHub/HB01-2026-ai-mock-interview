import { describe, expect, it } from "vitest";

import { TOPIC_COVERAGE_MAX_PER_SESSION } from "@/modules/interview/constants/topic-coverage";
import {
  buildTopicCoverageGeneratorPrompt,
  INSTRUCTIONS_SECTION_HEADER,
  TRANSCRIPT_SECTION_HEADER,
} from "@/modules/interview/prompts/topic-coverage-generator-prompt";
import {
  buildInterviewLocalePromptBlock,
  LANGUAGE_SECTION_HEADER,
} from "@/shared/interview-locale/interview-locale";

const sampleTranscript =
  "Human: How do you handle caching?\nAI: What trade-offs did you consider?";

describe("buildTopicCoverageGeneratorPrompt", () => {
  const baseParams = {
    transcript: sampleTranscript,
    interviewLocale: "en" as const,
  };

  it.each(["en", "pt"] as const)(
    "ends with the %s locale language block after instructions",
    (interviewLocale) => {
      const prompt = buildTopicCoverageGeneratorPrompt({
        transcript: sampleTranscript,
        interviewLocale,
      });
      const localeBlock = buildInterviewLocalePromptBlock(interviewLocale);

      expect(prompt.endsWith(localeBlock)).toBe(true);
      expect(prompt.indexOf(INSTRUCTIONS_SECTION_HEADER)).toBeLessThan(
        prompt.lastIndexOf(LANGUAGE_SECTION_HEADER),
      );
    },
  );

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

  it("still ends with locale block when job description is present", () => {
    const prompt = buildTopicCoverageGeneratorPrompt({
      ...baseParams,
      jobDescription: "Senior backend engineer",
    });

    expect(prompt.endsWith(buildInterviewLocalePromptBlock("en"))).toBe(true);
  });
});
