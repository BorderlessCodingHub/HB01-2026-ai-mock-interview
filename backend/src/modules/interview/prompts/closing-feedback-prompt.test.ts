import { describe, expect, it } from "vitest";

import {
  appendClosingFeedbackCta,
  buildClosingFeedbackPrompt,
  CLOSING_FEEDBACK_CTA,
  CLOSING_FEEDBACK_WORD_BUDGET,
  CLOSING_FORMAT_HEADER,
  CLOSING_SECURITY_HEADER,
  closingFeedbackCtaStreamSuffix,
  resolveClosingFeedbackLengthBand,
  toCandidateTurnBudget,
} from "@/modules/interview/prompts/closing-feedback-prompt";
import {
  buildInterviewLocalePromptBlock,
  getClosingFeedbackCopy,
  LANGUAGE_SECTION_HEADER,
} from "@/shared/interview-locale/interview-locale";

const sampleResumeSummary = {
  personal_info: { name: "Jane", title: "Engineer", about: "" },
  skills: ["TypeScript"],
  experiences: [{ company: "Acme", role: "Dev", highlights: ["APIs"] }],
  projects: [],
  certifications: [],
};

describe("buildClosingFeedbackPrompt interviewLocale", () => {
  const baseParams = {
    level: "mid" as const,
    resumeSummary: sampleResumeSummary,
    maxTurns: 8,
  };

  it("ends with the locale language block for en and uses English closing copy", () => {
    const copy = getClosingFeedbackCopy("en");
    const prompt = buildClosingFeedbackPrompt({
      ...baseParams,
      interviewLocale: "en",
    });

    expect(prompt.endsWith(buildInterviewLocalePromptBlock("en"))).toBe(true);
    expect(prompt).toContain(copy.wentWellHeader);
    expect(prompt).toContain(copy.workOnHeader);
    expect(prompt).toContain(copy.replyInstruction);
    expect(prompt).toContain(CLOSING_FORMAT_HEADER);
    expect(prompt).not.toContain(getClosingFeedbackCopy("pt").wentWellHeader);
    expect(prompt).not.toContain("Reply in Portuguese.");
    expect(prompt.lastIndexOf(LANGUAGE_SECTION_HEADER)).toBeGreaterThan(
      prompt.indexOf(CLOSING_SECURITY_HEADER),
    );
  });

  it("ends with the locale language block for pt and uses Portuguese closing copy", () => {
    const copy = getClosingFeedbackCopy("pt");
    const prompt = buildClosingFeedbackPrompt({
      ...baseParams,
      interviewLocale: "pt",
    });

    expect(prompt.endsWith(buildInterviewLocalePromptBlock("pt"))).toBe(true);
    expect(prompt).toContain(copy.wentWellHeader);
    expect(prompt).toContain(copy.workOnHeader);
    expect(prompt).toContain(copy.replyInstruction);
    expect(copy.cta).toBe(CLOSING_FEEDBACK_CTA);
    expect(prompt).not.toContain(getClosingFeedbackCopy("en").wentWellHeader);
    expect(prompt).not.toContain("Reply in English.");
  });

  it("does not hardcode Portuguese-only format when locale is en", () => {
    const prompt = buildClosingFeedbackPrompt({
      ...baseParams,
      interviewLocale: "en",
    });

    expect(prompt).not.toMatch(/Reply in Portuguese\./);
    expect(prompt).toContain("## What went well");
    expect(prompt).toContain("## What to work on");
  });
});

describe("closing feedback length band", () => {
  it("maps stored maxTurns to candidate turns (ready message is not counted)", () => {
    expect(toCandidateTurnBudget(1)).toBe(1);
    expect(toCandidateTurnBudget(4)).toBe(3);
    expect(toCandidateTurnBudget(8)).toBe(7);
    expect(toCandidateTurnBudget(21)).toBe(20);
  });

  it.each([
    [4, "short"],
    [7, "short"],
    [8, "medium"],
    [13, "medium"],
    [14, "long"],
    [21, "long"],
  ] as const)(
    "resolves stored maxTurns %s to the %s band",
    (maxTurns, band) => {
      expect(resolveClosingFeedbackLengthBand(maxTurns)).toBe(band);
    },
  );

  it("uses a short word budget for few candidate turns", () => {
    const prompt = buildClosingFeedbackPrompt({
      level: "mid",
      resumeSummary: sampleResumeSummary,
      maxTurns: 4,
      interviewLocale: "en",
    });
    const { min, max } = CLOSING_FEEDBACK_WORD_BUDGET.short;

    expect(prompt).toContain("This session had 3 candidate turns.");
    expect(prompt).toContain(`Maximum ${min}-${max} words.`);
    expect(prompt).not.toContain("Maximum 250-280 words.");
  });

  it("uses a medium word budget around current default lengths", () => {
    const prompt = buildClosingFeedbackPrompt({
      level: "mid",
      resumeSummary: sampleResumeSummary,
      maxTurns: 8,
      interviewLocale: "en",
    });
    const { min, max } = CLOSING_FEEDBACK_WORD_BUDGET.medium;

    expect(prompt).toContain("This session had 7 candidate turns.");
    expect(prompt).toContain(`Maximum ${min}-${max} words.`);
  });

  it("uses a long word budget for sessions up to 20 candidate turns", () => {
    const prompt = buildClosingFeedbackPrompt({
      level: "mid",
      resumeSummary: sampleResumeSummary,
      maxTurns: 21,
      interviewLocale: "en",
    });
    const { min, max } = CLOSING_FEEDBACK_WORD_BUDGET.long;

    expect(prompt).toContain("This session had 20 candidate turns.");
    expect(prompt).toContain(`Maximum ${min}-${max} words.`);
  });

  it("does not prescribe a bullet quota in the output template", () => {
    const prompt = buildClosingFeedbackPrompt({
      level: "mid",
      resumeSummary: sampleResumeSummary,
      maxTurns: 8,
      interviewLocale: "en",
    });

    expect(prompt).not.toMatch(/second and\/or third/i);
    expect(prompt).not.toMatch(/third or fourth bullet/i);
    expect(prompt).not.toMatch(
      /- \[specific, actionable improvement with context\]\r?\n- \[specific, actionable improvement with context\]/,
    );
    expect(prompt).toContain("not a fixed quota and not the turn count");
    expect(prompt).toContain(
      "one bullet per distinct genuine technical strength",
    );
    expect(prompt).toContain(
      "one bullet per distinct, actionable improvement",
    );
  });
});

describe("closing feedback CTA helpers", () => {
  it("appendClosingFeedbackCta uses localized CTA", () => {
    const enCta = getClosingFeedbackCopy("en").cta;
    const ptCta = getClosingFeedbackCopy("pt").cta;

    expect(appendClosingFeedbackCta("body", "en")).toBe(`body\n\n${enCta}`);
    expect(appendClosingFeedbackCta("body", "pt")).toBe(`body\n\n${ptCta}`);
    expect(appendClosingFeedbackCta(`body\n\n${enCta}`, "en")).toBe(
      `body\n\n${enCta}`,
    );
  });

  it("closingFeedbackCtaStreamSuffix uses localized CTA", () => {
    expect(closingFeedbackCtaStreamSuffix("en")).toBe(
      `\n\n${getClosingFeedbackCopy("en").cta}`,
    );
    expect(closingFeedbackCtaStreamSuffix("pt")).toBe(
      `\n\n${getClosingFeedbackCopy("pt").cta}`,
    );
  });
});
