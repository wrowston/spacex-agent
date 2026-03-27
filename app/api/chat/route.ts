import {
  stepCountIs,
  streamText,
  type ModelMessage,
  type UIMessage,
} from "ai";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CHAT_SYSTEM_PROMPT_WITH_SPACEX, getChatModel } from "@/lib/ai/openrouter";
import { spacexTools } from "@/lib/ai/tools/spacex";
import { getTextFromUIMessage } from "@/lib/chat/messages";

type ChatRequestBody = {
  id?: string;
  message?: UIMessage;
};

function toModelMessages(
  messages: Array<{ role: "user" | "assistant"; text: string }>,
): ModelMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.text,
  }));
}

const TOOL_LOG_OUTPUT_MAX = 800;

function stringifyForToolLog(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function truncateForToolLog(value: unknown): string {
  const s = stringifyForToolLog(value);
  if (s.length <= TOOL_LOG_OUTPUT_MAX) return s;
  return `${s.slice(0, TOOL_LOG_OUTPUT_MAX)}…`;
}

export async function POST(request: Request) {
  try {
    const { id, message }: ChatRequestBody = await request.json();

    if (!id || !message) {
      return Response.json(
        { error: "Missing conversation id or message." },
        { status: 400 },
      );
    }

    if (message.role !== "user") {
      return Response.json(
        { error: "Only user messages can be submitted." },
        { status: 400 },
      );
    }

    const conversationId = id as Id<"conversations">;
    const userText = getTextFromUIMessage(message);

    if (!userText) {
      return Response.json(
        { error: "Message text cannot be empty." },
        { status: 400 },
      );
    }

    const conversation = await fetchQuery(api.conversations.getConversation, {
      conversationId,
    });

    if (!conversation) {
      return Response.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    const persistedMessages = await fetchQuery(
      api.messages.listMessagesByConversation,
      {
        conversationId,
      },
    );

    await fetchMutation(api.messages.appendUserMessage, {
      conversationId,
      text: userText,
    });

    const result = streamText({
      model: getChatModel(),
      system: CHAT_SYSTEM_PROMPT_WITH_SPACEX,
      tools: spacexTools,
      stopWhen: stepCountIs(12),
      messages: [
        ...toModelMessages(persistedMessages),
        {
          role: "user",
          content: userText,
        },
      ],
      experimental_onToolCallStart: ({ stepNumber, toolCall }) => {
        console.info("[chat/tool] start", {
          conversationId,
          stepNumber,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          input: toolCall.input,
        });
      },
      experimental_onToolCallFinish: (event) => {
        const { stepNumber, toolCall, durationMs } = event;
        const base = {
          conversationId,
          stepNumber,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          durationMs,
        };
        if (event.success) {
          console.info("[chat/tool] finish", {
            ...base,
            outputPreview: truncateForToolLog(event.output),
          });
        } else {
          console.error("[chat/tool] finish", {
            ...base,
            error: event.error,
          });
        }
      },
    });

    void result.consumeStream();

    return result.toUIMessageStreamResponse({
      onFinish: async ({ responseMessage }) => {
        const assistantText = getTextFromUIMessage(responseMessage);

        if (!assistantText) {
          return;
        }

        await fetchMutation(api.messages.appendAssistantMessage, {
          conversationId,
          text: assistantText,
        });
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to process request.";

    return Response.json({ error: message }, { status: 500 });
  }
}
