"use client";

import { useEffect, useRef } from "react";
import type { ChatStatus, UIMessage } from "ai";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
import {
  isRenderableToolPart,
  ToolCallPart,
} from "@/components/chat/tool-call-part";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type MessageListProps = {
  messages: UIMessage[];
  status: ChatStatus;
};

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function messageHasVisibleContent(message: UIMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === "text") {
      return part.text.trim().length > 0;
    }
    if (isRenderableToolPart(part)) {
      return true;
    }
    return false;
  });
}

export function MessageList({ messages, status }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [messages, status]);

  const lastMessage = messages[messages.length - 1];
  const hideStreamingSkeleton =
    lastMessage?.role === "assistant" && messageHasVisibleContent(lastMessage);

  const showAssistantSkeleton = status !== "ready" && !hideStreamingSkeleton;

  return (
    <ScrollArea className="h-full min-h-0 flex-1 overscroll-y-contain px-4">
      <div className="mx-auto max-w-3xl space-y-6 py-6 pb-8">
        {messages.map((message) => {
          const isUser = message.role === "user";

          if (isUser) {
            const text = getMessageText(message);
            if (!text) {
              return null;
            }
            return (
              <div
                key={message.id}
                className="flex justify-end"
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    "bg-primary text-primary-foreground",
                  )}
                >
                  <ChatMessageMarkdown content={text} variant="user" />
                </div>
              </div>
            );
          }

          const assistantBlocks = message.parts
            .map((part, index) => {
              if (part.type === "text") {
                if (!part.text.trim()) {
                  return null;
                }
                return (
                  <div
                    key={`${message.id}-text-${index}`}
                    className={cn(
                      "rounded-2xl px-4 py-3 text-sm shadow-sm",
                      "border border-border/60 bg-card text-card-foreground",
                    )}
                  >
                    <ChatMessageMarkdown
                      content={part.text}
                      variant="assistant"
                    />
                  </div>
                );
              }

              if (isRenderableToolPart(part)) {
                return (
                  <ToolCallPart
                    key={part.toolCallId ?? `${message.id}-tool-${index}`}
                    part={part}
                  />
                );
              }

              return null;
            })
            .filter(Boolean);

          if (assistantBlocks.length === 0) {
            return null;
          }

          return (
            <div key={message.id} className="flex justify-start">
              <div className="flex max-w-[85%] flex-col gap-3">
                {assistantBlocks}
              </div>
            </div>
          );
        })}

        {showAssistantSkeleton ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl border border-border/60 bg-muted/40 px-4 py-3">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-56" />
                <Skeleton className="h-3.5 w-32" />
              </div>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
