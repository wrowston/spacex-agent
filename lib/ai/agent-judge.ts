import "server-only";

import { generateText } from "ai";

import { getChatModel } from "@/lib/ai/openrouter";

export type AgentJudgeResult = {
  pass: boolean;
  reason: string;
};

/**
 * Optional LLM-as-judge for behaviors that are awkward to assert with substrings.
 * Requires `OPENROUTER_API_KEY`. Gate CI or local runs with `RUN_JUDGE=1` to control cost.
 */
export async function runAgentJudge(options: {
  userMessage: string;
  assistantText: string;
  rubric: string;
}): Promise<AgentJudgeResult> {
  const { text } = await generateText({
    model: getChatModel(),
    messages: [
      {
        role: "user",
        content: `You are a strict evaluator for a SpaceX-focused chat assistant. Reply with ONLY one JSON object, no markdown fences, no other text. Use this exact shape: {"pass": boolean, "reason": string}

Rubric:
${options.rubric}

User message:
${options.userMessage}

Assistant reply:
${options.assistantText}`,
      },
    ],
    temperature: 0,
  });

  const trimmed = text.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return {
      pass: false,
      reason: `Judge did not return JSON: ${trimmed.slice(0, 240)}`,
    };
  }

  const parsed = JSON.parse(trimmed.slice(jsonStart, jsonEnd + 1)) as {
    pass?: unknown;
    reason?: unknown;
  };

  return {
    pass: Boolean(parsed.pass),
    reason:
      typeof parsed.reason === "string" ? parsed.reason : "missing reason field",
  };
}
