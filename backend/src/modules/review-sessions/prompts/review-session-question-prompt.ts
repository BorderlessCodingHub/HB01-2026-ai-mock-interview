import type { ReviewSessionTurn } from "@/modules/review-sessions/protocols/review-session-question-generator";
import {
  buildInterviewLocalePromptBlock,
  type InterviewLocale,
} from "@/shared/interview-locale/interview-locale";

export const PERSONA_SECTION_HEADER = "## Role";
export const TOPIC_SECTION_HEADER = "## Topic";
export const ANGLE_SECTION_HEADER = "## Angle";
export const DESCRIPTION_SECTION_HEADER = "## Description";
export const PRIOR_TURNS_SECTION_HEADER = "## Prior Q&A for this topic";
export const INSTRUCTIONS_SECTION_HEADER = "## Instructions";

export type BuildReviewSessionQuestionPromptParams = {
  topic: string;
  angle: string;
  description: string;
  turns: ReviewSessionTurn[];
  interviewLocale: InterviewLocale;
};

function buildPersonaBlock(): string {
  return `${PERSONA_SECTION_HEADER}
You are probing a candidate's understanding of exactly one review item — a specific angle within a topic from their study list.`;
}

function buildPriorTurnsBlock(turns: ReviewSessionTurn[]): string | null {
  if (turns.length === 0) {
    return null;
  }

  const lines = turns.flatMap((turn, index) => [
    `Q${index + 1}: ${turn.question}`,
    `A${index + 1}: ${turn.answer}`,
  ]);

  return `${PRIOR_TURNS_SECTION_HEADER}
${lines.join("\n")}`;
}

function buildInstructionsBlock(): string {
  return `${INSTRUCTIONS_SECTION_HEADER}
Ask exactly one focused question about the given angle within the topic. No preamble, introduction, or explanation before the question.
Never ask the candidate to write, paste, complete, or produce code of any kind (functions, snippets, algorithms, SQL, configs, or pseudocode). The question must be answerable in natural language about the given angle.`;
}

export function buildReviewSessionQuestionPrompt(
  params: BuildReviewSessionQuestionPromptParams,
): string {
  const sections = [
    buildPersonaBlock(),
    `${TOPIC_SECTION_HEADER}
${params.topic}`,
    `${ANGLE_SECTION_HEADER}
${params.angle}`,
    `${DESCRIPTION_SECTION_HEADER}
${params.description}`,
  ];

  const priorTurns = buildPriorTurnsBlock(params.turns);
  if (priorTurns) {
    sections.push(priorTurns);
  }

  sections.push(buildInstructionsBlock());
  sections.push(buildInterviewLocalePromptBlock(params.interviewLocale));

  return sections.join("\n\n");
}
