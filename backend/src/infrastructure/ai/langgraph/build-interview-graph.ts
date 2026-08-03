import { HumanMessage } from "@langchain/core/messages";

import type { BaseCallbackHandler } from "@langchain/core/callbacks/base";

import { END, START, StateGraph } from "@langchain/langgraph";

import type { BaseCheckpointSaver } from "@langchain/langgraph";

import type {
  IInterviewGraph,
  InterviewGraphInput,
} from "@/modules/interview/protocols/interview-graph";

import { InterviewGraphStateAnnotation } from "./interview-state";

import { createInterviewerNode } from "./nodes/interviewer-node";

import {
  appendClosingFeedbackCta,
  closingFeedbackCtaStreamSuffix,
} from "@/modules/interview/prompts/closing-feedback-prompt";

import {
  extractStreamTokenFromChunk,
  resolveCompletedAiMessage,
} from "./stream-message-tokens";

export type BuildInterviewGraphDeps = {
  checkpointer: BaseCheckpointSaver;
};

function buildCompiledGraph(deps: BuildInterviewGraphDeps) {
  return new StateGraph(InterviewGraphStateAnnotation)
    .addNode("interviewer", createInterviewerNode())
    .addEdge(START, "interviewer")
    .addEdge("interviewer", END)
    .compile({ checkpointer: deps.checkpointer });
}

export function createInterviewGraphConfig(sessionId: string) {
  return {
    configurable: {
      thread_id: sessionId,
    },
  };
}

export function buildInterviewGraph(
  checkpointer: BaseCheckpointSaver,
): IInterviewGraph {
  const graph = buildCompiledGraph({ checkpointer });

  return {
    async *streamMessages(
      input: InterviewGraphInput,

      options: { threadId: string; callbacks?: BaseCallbackHandler[] },
    ) {
      const lastMessage = input.messages.at(-1);

      const humanContent = lastMessage?.content ?? "";

      const graphConfig = createInterviewGraphConfig(options.threadId);

      const stream = await graph.stream(
        {
          messages: [new HumanMessage(humanContent)],

          turnCount: input.turnCount,

          maxTurns: input.maxTurns,

          level: input.level,

          userId: input.userId,

          resumeSummary: input.resumeSummary,

          jobDescription: input.jobDescription ?? undefined,

          interviewLocale: input.interviewLocale,

          isFinished: input.isFinished,

          runReview: input.runReview,

          recentCoverage: input.recentCoverage ?? [],

          activeReviewTopics: input.activeReviewTopics ?? [],
        },

        {
          ...graphConfig,

          streamMode: "messages",
          callbacks: options.callbacks,
        },
      );

      for await (const chunk of stream) {
        const content = extractStreamTokenFromChunk(chunk);

        if (content) {
          yield { content };
        }
      }

      const snapshot = await graph.getState(graphConfig);
      const completedAiMessage = resolveCompletedAiMessage(
        snapshot.values.messages,
      );

      if (!input.runReview || !completedAiMessage) {
        return completedAiMessage;
      }

      yield { content: closingFeedbackCtaStreamSuffix(input.interviewLocale) };

      return {
        ...completedAiMessage,
        content: appendClosingFeedbackCta(
          completedAiMessage.content,
          input.interviewLocale,
        ),
      };
    },
  };
}

export type CompiledInterviewGraph = ReturnType<typeof buildCompiledGraph>;

/** Exposed for unit tests that assert graph compilation with a mocked checkpointer. */

export function buildInterviewGraphForTest(
  deps: BuildInterviewGraphDeps,
): CompiledInterviewGraph {
  return buildCompiledGraph(deps);
}
