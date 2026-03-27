"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useQuery } from "convex/react";
import { AlertCircle, Notebook, Plus } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ChatEmptyState } from "@/components/chat/chat-empty-state";
import { Composer } from "@/components/chat/composer";
import { MessageList } from "@/components/chat/message-list";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { persistedMessagesToUIMessages } from "@/lib/chat/messages";

type ChatShellProps = {
  conversationId: Id<"conversations">;
};

type ChatSessionProps = {
  conversationId: Id<"conversations">;
  title: string;
  initialMessages: UIMessage[];
};

function ChatShellLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-center border-b border-border/60 px-4 md:justify-between">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="hidden h-8 w-24 md:block" />
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4">
        <Skeleton className="mx-auto h-8 w-64" />
        <div className="mt-auto space-y-2">
          <Skeleton className="h-28 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function MissingConversation() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md border-border/70 bg-card/90 shadow-sm">
        <CardHeader>
          <CardTitle>Conversation not found</CardTitle>
          <CardDescription>
            Start a new thread to continue chatting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" className={buttonVariants()}>
            <Plus className="size-4" />
            New chat
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function ChatSession({
  conversationId,
  title,
  initialMessages,
}: ChatSessionProps) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest({ id, messages }) {
          return {
            body: {
              id,
              message: messages[messages.length - 1],
            },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, stop, status, error, clearError } = useChat({
    id: conversationId,
    messages: initialMessages,
    transport,
  });

  const hasMessages = messages.length > 0;

  function handleSubmit() {
    const text = input.trim();

    if (!text || status !== "ready") {
      return;
    }

    clearError();
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/60 px-4">
        <div className="min-w-0 flex-1 text-center md:text-left">
          <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">
            {title}
          </h1>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <span className="text-xs text-muted-foreground">Orbital Chat</span>
          <Notebook className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{error.message}</p>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {hasMessages ? (
          <MessageList messages={messages} status={status} />
        ) : (
          <ChatEmptyState onFillInput={setInput} />
        )}
      </div>

      <div className="shrink-0 border-t border-border/60 bg-background/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Composer
          input={input}
          onInputChange={(value) => {
            if (error) {
              clearError();
            }
            setInput(value);
          }}
          onSubmit={handleSubmit}
          onStop={stop}
          status={status}
        />
      </div>
    </div>
  );
}

export function ChatShell({ conversationId }: ChatShellProps) {
  const conversation = useQuery(api.conversations.getConversation, {
    conversationId,
  });
  const persistedMessages = useQuery(api.messages.listMessagesByConversation, {
    conversationId,
  });

  if (conversation === undefined || persistedMessages === undefined) {
    return <ChatShellLoading />;
  }

  if (conversation === null) {
    return <MissingConversation />;
  }

  return (
    <ChatSession
      key={conversationId}
      conversationId={conversationId}
      title={conversation.title}
      initialMessages={persistedMessagesToUIMessages(persistedMessages)}
    />
  );
}
