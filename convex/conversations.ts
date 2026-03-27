import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const DEFAULT_CONVERSATION_TITLE = "New conversation";

export const createConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    return await ctx.db.insert("conversations", {
      title: DEFAULT_CONVERSATION_TITLE,
      updatedAt: now,
    });
  },
});

export const getConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.conversationId);
  },
});

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("conversations")
      .withIndex("by_updatedAt", (q) => q)
      .order("desc")
      .take(120);
  },
});
