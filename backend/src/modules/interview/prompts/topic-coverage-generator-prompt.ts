import { TOPIC_COVERAGE_MAX_PER_SESSION } from "@/modules/interview/constants/topic-coverage";
import { buildJobDescriptionBlock } from "@/modules/interview/prompts/interviewer-system-prompt";

export const PERSONA_SECTION_HEADER = "## Role";
export const TRANSCRIPT_SECTION_HEADER = "## Interview transcript";
export const INSTRUCTIONS_SECTION_HEADER = "## Instructions";

export type BuildTopicCoverageGeneratorPromptParams = {
  transcript: string;
  jobDescription?: string | null;
};

function buildPersonaBlock(): string {
  return `${PERSONA_SECTION_HEADER}
You are a Tech Lead summarizing what technical topics and angles were actually explored during a mock interview.`;
}

function buildInstructionsBlock(hasJobDescription: boolean): string {
  const targetRoleClause = hasJobDescription
    ? "\n- When a target role is provided, favor topic labels that reflect skills relevant to that role."
    : "";

  return `${INSTRUCTIONS_SECTION_HEADER}
From the transcript, extract representative topic + angle pairs that were genuinely discussed between interviewer and candidate.
The transcript may be in any language; that does not change the output language.

Rules:
- Emit at most ${TOPIC_COVERAGE_MAX_PER_SESSION} pairs — pick the most salient coverage, not every minor mention.
- Each pair has:
  - topic: a short free-text label for the skill or knowledge area (e.g. "system design", "TypeScript generics").
  - angle: a specific, concise free-text description of how the topic was explored (e.g. "trade-offs", "debugging", "API design", "latency vs accuracy trade-offs"). Prefer short phrases; use a longer description only when needed to keep the angle unambiguous.
- Always write topic and angle in English only. These are internal labels for an English system prompt, not candidate-facing text.
- Prefer a concrete technical focus over vague labels like "overview", "discussion", or "basics".
- Do not invent topics or angles that were not discussed in the transcript.
- If nothing substantive was covered, return an empty items list.${targetRoleClause}`;
}

export function buildTopicCoverageGeneratorPrompt(
  params: BuildTopicCoverageGeneratorPromptParams,
): string {
  const hasJobDescription = Boolean(params.jobDescription);
  const sections = [
    buildPersonaBlock(),
    `${TRANSCRIPT_SECTION_HEADER}
${params.transcript}`,
  ];

  if (params.jobDescription) {
    sections.push(buildJobDescriptionBlock(params.jobDescription));
  }

  sections.push(buildInstructionsBlock(hasJobDescription));

  return sections.join("\n\n");
}
