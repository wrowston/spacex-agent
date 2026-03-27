import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

import { DEFAULT_CONVERSATION_TITLE } from "./conversations";

function createConversationTitle(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= 56) {
    return normalized;
  }

  return `${normalized.slice(0, 53).trimEnd()}...`;
}

export const listMessagesByConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_conversation", (query) =>
        query.eq("conversationId", args.conversationId),
      )
      .collect();
  },
});

export const appendUserMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();

    if (!text) {
      throw new Error("User message cannot be empty.");
    }

    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "user",
      text,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
      title:
        conversation.title === DEFAULT_CONVERSATION_TITLE
          ? createConversationTitle(text)
          : conversation.title,
    });

    return messageId;
  },
});

export const appendAssistantMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const text = args.text.trim();

    if (!text) {
      throw new Error("Assistant message cannot be empty.");
    }

    const conversation = await ctx.db.get(args.conversationId);

    if (!conversation) {
      throw new Error("Conversation not found.");
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      role: "assistant",
      text,
    });

    await ctx.db.patch(args.conversationId, {
      updatedAt: Date.now(),
    });

    return messageId;
  },
});
