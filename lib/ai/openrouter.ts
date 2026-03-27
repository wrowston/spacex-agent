import "server-only";

import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-5.4-mini";

export const CHAT_SYSTEM_PROMPT =
  "You are a helpful conversational assistant. Give clear, concise answers, use the prior conversation for follow-up questions, and say when you are unsure instead of inventing facts.";

export function getChatModel() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelId = process.env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL;

  return openrouter.chat(modelId);
}
