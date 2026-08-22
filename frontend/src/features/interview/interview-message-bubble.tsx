import { Bot, Check, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";

import { cn } from "@/lib/utils";

type InterviewMessageBubbleProps = {
  role: "human" | "ai";
  content: string;
  isStreaming?: boolean;
  isTyping?: boolean;
};

const markdownClassName = {
  shared:
    "max-w-none space-y-2 text-sm leading-relaxed [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_strong]:font-semibold [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-2",
  human:
    "text-white [&_a]:text-white [&_a]:underline [&_code]:bg-white/20 [&_pre]:bg-black/20",
  ai: "text-ink-black [&_code]:bg-mist-gray [&_pre]:bg-mist-gray",
} as const;

export function InterviewMessageBubble({
  role,
  content,
  isStreaming = false,
  isTyping = false,
}: InterviewMessageBubbleProps) {
  const isHuman = role === "human";

  return (
    <div
      className={cn("flex gap-3", isHuman ? "justify-end" : "justify-start")}
    >
      {!isHuman && (
        <div className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-jade-pale text-jade-deep md:flex">
          <Bot className="size-4" />
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
          isHuman
            ? "rounded-tr-md bg-jade-deep text-white"
            : "rounded-tl-md border border-border-hairline bg-paper-white text-ink-black",
        )}
      >
        {isTyping ? (
          <div className="flex items-center gap-1.5 py-0.5">
            <span className="size-2 animate-pulse rounded-full bg-slate-gray/55" />
            <span className="size-2 animate-pulse rounded-full bg-slate-gray/55 [animation-delay:150ms]" />
            <span className="size-2 animate-pulse rounded-full bg-slate-gray/55 [animation-delay:300ms]" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <div
              className={cn(
                markdownClassName.shared,
                isHuman ? markdownClassName.human : markdownClassName.ai,
              )}
            >
              <ReactMarkdown
                remarkPlugins={isHuman ? [remarkBreaks] : undefined}
              >
                {content}
              </ReactMarkdown>
            </div>
            {isStreaming && (
              <span className="mt-1 inline-flex items-center gap-1 text-xs text-text-base">
                <Loader2 className="h-3 w-3 animate-spin" />
                Interviewer typing…
              </span>
            )}
          </div>
        )}
      </div>

      {isHuman && (
        <div className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-ink-black text-white md:flex">
          <Check className="size-4" />
        </div>
      )}
    </div>
  );
}
