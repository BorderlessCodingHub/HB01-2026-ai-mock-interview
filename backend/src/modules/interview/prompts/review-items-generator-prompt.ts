import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import { buildJobDescriptionBlock } from "@/modules/interview/prompts/interviewer-system-prompt";
import { resumeToMarkdown } from "@/modules/resumes/format/resume-to-markdown";
import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";
import {
  buildInterviewLocalePromptBlock,
  type InterviewLocale,
} from "@/shared/interview-locale/interview-locale";

export const PERSONA_SECTION_HEADER = "## Role";
export const TRANSCRIPT_SECTION_HEADER = "## Interview transcript";
export const EXISTING_ITEMS_SECTION_HEADER = "## Existing review items";
export const CANDIDATE_RESUME_SECTION_HEADER = "## Candidate résumé";
export const INSTRUCTIONS_SECTION_HEADER = "## Instructions";

export type ExistingReviewItemForPrompt = {
  topic: string;
  angle: string;
  description: string;
  priority: ReviewPriority;
};

export type BuildReviewItemsGeneratorPromptParams = {
  transcript: string;
  existingItems: ExistingReviewItemForPrompt[];
  structuredSummary: StructuredSummary;
  interviewLocale?: InterviewLocale;
  jobDescription?: string | null;
};

function buildExistingItemsBlock(
  existingItems: ExistingReviewItemForPrompt[],
): string {
  if (existingItems.length === 0) {
    return `${EXISTING_ITEMS_SECTION_HEADER}
(none)`;
  }

  return `${EXISTING_ITEMS_SECTION_HEADER}
${JSON.stringify(existingItems, null, 2)}`;
}

function buildPersonaBlock(): string {
  return `${PERSONA_SECTION_HEADER}
You are a Tech Lead reviewing an interview to identify learning gaps.
Focus on what the candidate demonstrated — and what they did not — relative to the role and curriculum.`;
}

function buildInstructionsBlock(hasJobDescription: boolean): string {
  const targetRoleClause = hasJobDescription
    ? "\n- When a target role is provided, prioritize gaps relative to those job requirements."
    : "";

  return `${INSTRUCTIONS_SECTION_HEADER}
Identify gaps and weaknesses from the interview. Emit one item per distinct (topic, angle) pair.

- topic: short subject label (1–4 words), e.g. "Caching".
- angle: the specific interview probe/facet that exposed the gap (2–8 words), e.g. "write-path invalidation".
  Do not use vague angles like "general" or "basics" for new items.
- description: coaching narrative — what to practice and why.
- New (topic, angle) not in existing list: create with an appropriate priority.
- Existing (topic, angle) match (exact or clearly the same gap): omit it — do not re-emit or change its priority.
  Priority changes happen only in study/review sessions, not here.
- Same topic with a meaningfully different angle is a new item.
- No duplicate (topic, angle) pairs in a single response.${targetRoleClause}`;
}

export function buildReviewItemsGeneratorPrompt(
  params: BuildReviewItemsGeneratorPromptParams,
): string {
  const interviewLocale = params.interviewLocale ?? "en";
  const hasJobDescription = Boolean(params.jobDescription);
  const sections = [
    buildPersonaBlock(),
    `${TRANSCRIPT_SECTION_HEADER}
${params.transcript}`,
    buildExistingItemsBlock(params.existingItems),
    `${CANDIDATE_RESUME_SECTION_HEADER}
${resumeToMarkdown(params.structuredSummary)}`,
  ];

  if (params.jobDescription) {
    sections.push(buildJobDescriptionBlock(params.jobDescription));
  }

  sections.push(
    buildInstructionsBlock(hasJobDescription),
    buildInterviewLocalePromptBlock(interviewLocale),
  );

  return sections.join("\n\n");
}
