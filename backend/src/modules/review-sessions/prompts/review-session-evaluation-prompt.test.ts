import { describe, expect, it } from "vitest";

import {
  buildInterviewLocalePromptBlock,
  LANGUAGE_SECTION_HEADER,
} from "@/shared/interview-locale/interview-locale";

import {
  ANGLE_SECTION_HEADER,
  buildReviewSessionEvaluationPrompt,
  CURRENT_PRIORITY_SECTION_HEADER,
  DESCRIPTION_SECTION_HEADER,
  INSTRUCTIONS_SECTION_HEADER,
  TOPIC_SECTION_HEADER,
  TURNS_SECTION_HEADER,
} from "./review-session-evaluation-prompt";

describe("buildReviewSessionEvaluationPrompt", () => {
  const baseParams = {
    topic: "System design trade-offs",
    angle: "consistency model comparison",
    description: "Candidate struggled to compare consistency models.",
    currentPriority: "high" as const,
    turns: [
      {
        question: "How would you choose between CP and AP?",
        answer: "It depends on business requirements and failure tolerance.",
      },
    ],
    interviewLocale: "en" as const,
  };

  it("includes scoped item inputs only", () => {
    const prompt = buildReviewSessionEvaluationPrompt(baseParams);

    expect(prompt).toContain(TOPIC_SECTION_HEADER);
    expect(prompt).toContain(baseParams.topic);
    expect(prompt).toContain(ANGLE_SECTION_HEADER);
    expect(prompt).toContain(baseParams.angle);
    expect(prompt).toContain(DESCRIPTION_SECTION_HEADER);
    expect(prompt).toContain(baseParams.description);
    expect(prompt).toContain(CURRENT_PRIORITY_SECTION_HEADER);
    expect(prompt).toContain("high");
    expect(prompt).toContain(TURNS_SECTION_HEADER);
    expect(prompt).toContain(baseParams.turns[0]!.question);
    expect(prompt).toContain(baseParams.turns[0]!.answer);
  });

  it("encodes normative evaluation instructions", () => {
    const prompt = buildReviewSessionEvaluationPrompt(baseParams);

    expect(prompt).toContain(INSTRUCTIONS_SECTION_HEADER);
    expect(prompt).toContain('status: "learned"');
    expect(prompt).toContain("sufficient");
    expect(prompt).toContain('set `priority` to `null`');
    expect(prompt).toContain("never `null`");
    expect(prompt).toContain("never lower below `low`");
    expect(prompt).toContain("ambiguous");
    expect(prompt).toContain("keep the same priority");
    expect(prompt).toContain("clear evidence of improvement");
  });

  it("encodes recap bullet instructions", () => {
    const prompt = buildReviewSessionEvaluationPrompt(baseParams);

    expect(prompt).toContain("`wentWell`");
    expect(prompt).toContain("`workOn`");
    expect(prompt).toContain("never invent");
    expect(prompt).toContain("empty array");
    expect(prompt).toContain("no markdown");
    expect(prompt).toContain("grounded in the turns");
    expect(prompt).toContain("Q&A");
  });

  it.each(["en", "pt"] as const)(
    "ends with the %s language block as the last section",
    (interviewLocale) => {
      const prompt = buildReviewSessionEvaluationPrompt({
        ...baseParams,
        interviewLocale,
      });

      const lastSection = prompt.split("\n\n").at(-1);
      expect(lastSection).toBe(buildInterviewLocalePromptBlock(interviewLocale));
      expect(prompt).toContain(LANGUAGE_SECTION_HEADER);
      expect(prompt.indexOf(INSTRUCTIONS_SECTION_HEADER)).toBeLessThan(
        prompt.indexOf(LANGUAGE_SECTION_HEADER),
      );
    },
  );
});
