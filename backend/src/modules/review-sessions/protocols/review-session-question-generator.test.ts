import { describe, expect, it } from "vitest";

import type { IReviewSessionQuestionGenerator } from "./review-session-question-generator";

describe("IReviewSessionQuestionGenerator", () => {
  it("allows an implementation with streamQuestion returning tokens then final content", async () => {
    const generator: IReviewSessionQuestionGenerator = {
      async *streamQuestion() {
        yield { content: "What " };
        yield { content: "is CAP?" };
        return {
          content: "What is CAP?",
          usage: { promptTokens: 12, completionTokens: 4 },
        };
      },
    };

    const iterator = generator.streamQuestion({
      topic: "Distributed systems",
      angle: "consistency trade-offs",
      description: "Explain consistency trade-offs.",
      turns: [],
      interviewLocale: "en",
    });

    const tokens: string[] = [];
    let result = await iterator.next();

    while (!result.done) {
      tokens.push(result.value.content);
      result = await iterator.next();
    }

    expect(tokens).toEqual(["What ", "is CAP?"]);
    expect(result.value).toEqual({
      content: "What is CAP?",
      usage: { promptTokens: 12, completionTokens: 4 },
    });
  });
});
