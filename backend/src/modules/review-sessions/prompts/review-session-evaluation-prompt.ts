import type { ReviewPriority } from "@/modules/interview/validations/interview-schemas";
import type { ReviewSessionTurn } from "@/modules/review-sessions/protocols/review-session-evaluator";
import {
  buildInterviewLocalePromptBlock,
  type InterviewLocale,
} from "@/shared/interview-locale/interview-locale";

export const PERSONA_SECTION_HEADER = "## Role";
export const TOPIC_SECTION_HEADER = "## Topic";
export const ANGLE_SECTION_HEADER = "## Angle";
export const DESCRIPTION_SECTION_HEADER = "## Description";
export const CURRENT_PRIORITY_SECTION_HEADER = "## Current priority";
export const TURNS_SECTION_HEADER = "## Review Q&A";
export const INSTRUCTIONS_SECTION_HEADER = "## Instructions";

export type BuildReviewSessionEvaluationPromptParams = {
  topic: string;
  angle: string;
  description: string;
  currentPriority: ReviewPriority;
  turns: ReviewSessionTurn[];
  interviewLocale: InterviewLocale;
};

function buildPersonaBlock(): string {
  return `${PERSONA_SECTION_HEADER}
You are a Tech Lead evaluating whether a candidate has sufficiently addressed a specific angle within a review topic based only on their review-session answers.`;
}

function buildTurnsBlock(turns: ReviewSessionTurn[]): string {
  if (turns.length === 0) {
    return `${TURNS_SECTION_HEADER}
(none)`;
  }

  const lines = turns.flatMap((turn, index) => [
    `### Turn ${index + 1}`,
    `Question: ${turn.question}`,
    `Answer: ${turn.answer}`,
  ]);

  return `${TURNS_SECTION_HEADER}
${lines.join("\n")}`;
}

function buildInstructionsBlock(): string {
  return `${INSTRUCTIONS_SECTION_HEADER}
Suggest whether this single review item should stay active or be marked learned, and what priority to use if it stays active.

- Mark \`status: "learned"\` only when the answers demonstrate **sufficient** understanding of the angle within the topic — not merely getting one question right. When learned, set \`priority\` to \`null\`.
- When \`status: "active"\`, you **must** set \`priority\` to \`low\`, \`medium\`, or \`high\` (never \`null\`).
- Raise priority when the answers reinforce the existing gap.
- Lower priority only with **clear evidence of improvement** across the answers; never lower below \`low\`.
- If answers show no clear change (neither strong improvement nor reinforcement), keep the same priority.
- If answers reinforce the gap but the priority would otherwise stay unchanged, bump one step: \`low\` → \`medium\`, \`medium\` → \`high\`, \`high\` stays \`high\`.
- When the signal is ambiguous, prefer no change: keep \`status: "active"\` with the current priority.
- Base your decision only on the topic, angle, description, current priority, and review Q&A above — ignore any other context.
- Also fill \`wentWell\` (0–4 short bullets of genuine demonstrated strengths for this angle) and \`workOn\` (0–4 actionable gaps from this item's Q&A).
- Use an empty array when there is no genuine strength or nothing substantial to improve — never invent.
- Each bullet is one sentence, no markdown, grounded in the turns above.
- Field names stay English; content follows the language block.`;
}

export function buildReviewSessionEvaluationPrompt(
  params: BuildReviewSessionEvaluationPromptParams,
): string {
  return [
    buildPersonaBlock(),
    `${TOPIC_SECTION_HEADER}
${params.topic}`,
    `${ANGLE_SECTION_HEADER}
${params.angle}`,
    `${DESCRIPTION_SECTION_HEADER}
${params.description}`,
    `${CURRENT_PRIORITY_SECTION_HEADER}
${params.currentPriority}`,
    buildTurnsBlock(params.turns),
    buildInstructionsBlock(),
    buildInterviewLocalePromptBlock(params.interviewLocale),
  ].join("\n\n");
}
