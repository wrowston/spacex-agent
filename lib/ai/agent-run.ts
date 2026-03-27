import "server-only";

import {
  generateText,
  stepCountIs,
  type GenerateTextResult,
  type ModelMessage,
  type StepResult,
} from "ai";

import { CHAT_SYSTEM_PROMPT_WITH_SPACEX, getChatModel } from "@/lib/ai/openrouter";
import { spacexTools } from "@/lib/ai/tools/spacex";

/** Matches `stopWhen: stepCountIs(12)` in [`app/api/chat/route.ts`](app/api/chat/route.ts). */
export const DEFAULT_AGENT_MAX_STEPS = 12;

export type RunAgentTurnOptions = {
  messages: ModelMessage[];
  /** Defaults to {@link DEFAULT_AGENT_MAX_STEPS}. */
  maxSteps?: number;
  /** Override model (e.g. tests). */
  model?: ReturnType<typeof getChatModel>;
};

export async function runAgentTurn(
  options: RunAgentTurnOptions,
): Promise<GenerateTextResult<typeof spacexTools, never>> {
  const maxSteps = options.maxSteps ?? DEFAULT_AGENT_MAX_STEPS;
  const model = options.model ?? getChatModel();

  return generateText({
    model,
    system: CHAT_SYSTEM_PROMPT_WITH_SPACEX,
    tools: spacexTools,
    stopWhen: stepCountIs(maxSteps),
    messages: options.messages,
    temperature: 0,
  });
}

export type ToolInvocationSummary = {
  toolName: string;
  input: unknown;
};

/**
 * Collects tool calls across all steps (multi-step tool loops).
 */
export function collectToolInvocations(
  steps: Array<StepResult<typeof spacexTools>>,
): ToolInvocationSummary[] {
  const out: ToolInvocationSummary[] = [];
  for (const step of steps) {
    for (const tc of step.toolCalls) {
      out.push({ toolName: tc.toolName, input: tc.input });
    }
  }
  return out;
}

export function collectToolNames(
  steps: Array<StepResult<typeof spacexTools>>,
): string[] {
  return collectToolInvocations(steps).map((t) => t.toolName);
}
