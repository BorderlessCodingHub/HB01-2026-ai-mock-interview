import { MemorySaver } from "@langchain/langgraph";

import { describe, expect, it, vi } from "vitest";

import type { StructuredSummary } from "@/modules/resumes/validations/resume-schemas";

import {
  buildInterviewGraph,
  buildInterviewGraphForTest,
  createInterviewGraphConfig,
} from "./build-interview-graph";

type SoftHintState = {
  recentCoverage?: { topic: string; angle: string }[];
  activeReviewTopics?: { topic: string; priority: string }[];
};

let capturedState: unknown;

vi.mock("./nodes/interviewer-node", () => ({
  createInterviewerNode: () => async (state: SoftHintState) => {
    capturedState = state;
    return { messages: [] };
  },
}));

const minimalResume: StructuredSummary = {
  personal_info: {
    name: "Test",
    title: "Engineer",
    about: "",
  },
  skills: [],
  experiences: [],
  projects: [],
  certifications: [],
};

describe("buildInterviewGraph", () => {
  it("compiles a graph with only the interviewer LLM node", () => {
    const checkpointer = new MemorySaver();

    const graph = buildInterviewGraphForTest({ checkpointer });

    const drawable = graph.getGraph();

    const nodeIds = new Set(Object.keys(drawable.nodes));

    expect(nodeIds.has("interviewer")).toBe(true);

    expect(nodeIds.has("closing_feedback")).toBe(false);

    expect(nodeIds.has("tool_executor")).toBe(false);

    expect(typeof graph.stream).toBe("function");

    const config = createInterviewGraphConfig(
      "550e8400-e29b-41d4-a716-446655440000",
    );

    expect(config.configurable?.thread_id).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("returns an IInterviewGraph with streamMessages", () => {
    const adapter = buildInterviewGraph(new MemorySaver());

    expect(typeof adapter.streamMessages).toBe("function");
  });

  it("forwards soft coverage hints into graph state for the interviewer node", async () => {
    capturedState = undefined;
    const adapter = buildInterviewGraph(new MemorySaver());
    const recentCoverage = [{ topic: "PostgreSQL", angle: "indexing" }];
    const activeReviewTopics = [
      { topic: "Caching", priority: "high" as const },
    ];

    const stream = adapter.streamMessages(
      {
        messages: [{ role: "human", content: "Hello" }],
        turnCount: 0,
        maxTurns: 5,
        level: "entry",
        userId: 1,
        resumeSummary: minimalResume,
        interviewLocale: "pt",
        isFinished: false,
        runReview: false,
        recentCoverage,
        activeReviewTopics,
      },
      { threadId: "550e8400-e29b-41d4-a716-446655440001" },
    );

    for await (const _chunk of stream) {
      // drain stream
    }

    const state = capturedState as SoftHintState | undefined;
    expect(state?.recentCoverage).toEqual(recentCoverage);
    expect(state?.activeReviewTopics).toEqual(activeReviewTopics);
  });
});
