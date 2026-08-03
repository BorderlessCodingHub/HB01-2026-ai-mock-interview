import { describe, expect, it } from "vitest";

import {
  buildInterviewLocalePromptBlock,
  LANGUAGE_SECTION_HEADER,
} from "@/shared/interview-locale/interview-locale";

import {
  ANGLE_SECTION_HEADER,
  buildReviewSessionQuestionPrompt,
  DESCRIPTION_SECTION_HEADER,
  INSTRUCTIONS_SECTION_HEADER,
  PERSONA_SECTION_HEADER,
  PRIOR_TURNS_SECTION_HEADER,
  TOPIC_SECTION_HEADER,
} from "./review-session-question-prompt";

describe("buildReviewSessionQuestionPrompt", () => {
  const topic = "System design trade-offs";
  const angle = "CAP theorem implications";
  const description = "Practice articulating CAP theorem implications.";

  it("includes persona, topic, angle, description, and single-question instruction for question 1", () => {
    const prompt = buildReviewSessionQuestionPrompt({
      topic,
      angle,
      description,
      turns: [],
      interviewLocale: "en",
    });

    expect(prompt).toContain(PERSONA_SECTION_HEADER);
    expect(prompt).toContain("specific angle within a topic");
    expect(prompt).toContain(TOPIC_SECTION_HEADER);
    expect(prompt).toContain(topic);
    expect(prompt).toContain(ANGLE_SECTION_HEADER);
    expect(prompt).toContain(angle);
    expect(prompt).toContain(DESCRIPTION_SECTION_HEADER);
    expect(prompt).toContain(description);
    expect(prompt).toContain(INSTRUCTIONS_SECTION_HEADER);
    expect(prompt).toContain("Ask exactly one focused question");
    expect(prompt).toContain("No preamble");
    expect(prompt).not.toContain(PRIOR_TURNS_SECTION_HEADER);
  });

  it("includes only the provided item's prior turns for question k > 1", () => {
    const turns = [
      {
        question: "How would you scale reads?",
        answer: "Add replicas and cache hot keys.",
      },
      {
        question: "What about writes?",
        answer: "Shard by tenant id.",
      },
    ];

    const prompt = buildReviewSessionQuestionPrompt({
      topic,
      angle,
      description,
      turns,
      interviewLocale: "en",
    });

    expect(prompt).toContain(PRIOR_TURNS_SECTION_HEADER);
    expect(prompt).toContain("Q1: How would you scale reads?");
    expect(prompt).toContain("A1: Add replicas and cache hot keys.");
    expect(prompt).toContain("Q2: What about writes?");
    expect(prompt).toContain("A2: Shard by tenant id.");
    expect(prompt).not.toContain("Other item topic");
    expect(prompt).not.toContain("Unrelated answer");
  });

  it.each(["en", "pt"] as const)(
    "ends with the %s language block as the last section",
    (interviewLocale) => {
      const prompt = buildReviewSessionQuestionPrompt({
        topic,
        angle,
        description,
        turns: [],
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
