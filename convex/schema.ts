import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  conversations: defineTable({
    title: v.string(),
    updatedAt: v.number(),
  }).index("by_updatedAt", ["updatedAt"]),
  messages: defineTable({
    conversationId: v.id("conversations"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    text: v.string(),
  }).index("by_conversation", ["conversationId"]),
});
