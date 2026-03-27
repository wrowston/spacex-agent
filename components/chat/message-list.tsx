"use client";

import { useEffect, useRef } from "react";
import type { ChatStatus, UIMessage } from "ai";

import { ChatMessageMarkdown } from "@/components/chat/chat-message-markdown";
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

export function MessageList({ messages, status }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      block: "end",
      behavior: "smooth",
    });
  }, [messages, status]);

  return (
    <ScrollArea className="h-full min-h-0 flex-1 px-4">
      <div className="mx-auto max-w-3xl space-y-6 py-6 pb-4">
        {messages.map((message) => {
          const isUser = message.role === "user";
          const text = getMessageText(message);

          if (!text) {
            return null;
          }

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? "justify-end" : "justify-start"}`}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "border border-border/60 bg-card text-card-foreground",
                )}
              >
                <ChatMessageMarkdown
                  content={text}
                  variant={isUser ? "user" : "assistant"}
                />
              </div>
            </div>
          );
        })}

        {status !== "ready" ? (
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
