export const PERSONA_SECTION_HEADER = "## Role";
export const TASK_SECTION_HEADER = "## Task";
export const OUTPUT_FORMAT_SECTION_HEADER = "## Output format";
export const RESUME_TEXT_SECTION_HEADER = "## Résumé text";

function buildPersonaBlock(): string {
  return `${PERSONA_SECTION_HEADER}
You are a parser specialized in technical résumés.`;
}

function buildTaskBlock(): string {
  return `${TASK_SECTION_HEADER}
Extract a structured summary from the résumé text below for an AI-guided technical mock interview.

- Use only information present in the text; do not invent details.
- For experiences, capture résumé bullet points as highlights (achievements, metrics, responsibilities).
- For projects, include name and any description, technologies, or highlights when available.
- Skills should be concrete technologies, languages, frameworks, or tools.
- Include certifications only when present in the text.
- Keep strings concise; preserve the résumé language (Portuguese or English).`;
}

function buildOutputFormatBlock(): string {
  return `${OUTPUT_FORMAT_SECTION_HEADER}
Return a structured object with:
- personal_info: name, title, about
- skills: array of technologies, languages, frameworks, or tools
- experiences: company, role, highlights[]
- projects: name, description, technologies[], highlights[]
- certifications: array of certification names

Required values must never be empty:
- personal_info.name and personal_info.title are required; if no title is stated, use the role of the most recent experience.
- Each experience needs a company and a role, and each project needs a name; omit entries that lack them.
- Array items must be non-empty strings; never include "" in an array.

Only personal_info.about and project description may be "" when not present in the résumé. Use [] for missing arrays.`;
}

function buildResumeTextBlock(rawText: string): string {
  return `${RESUME_TEXT_SECTION_HEADER}

${rawText}`;
}

export function buildResumeExtractionPrompt(rawText: string): string {
  return [
    buildPersonaBlock(),
    buildTaskBlock(),
    buildOutputFormatBlock(),
    buildResumeTextBlock(rawText),
  ].join("\n\n");
}
