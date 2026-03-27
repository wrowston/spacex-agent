import assert from "node:assert/strict";

import { describe, expect, it } from "vitest";

import { runAgentJudge } from "@/lib/ai/agent-judge";
import {
  collectToolInvocations,
  collectToolNames,
  DEFAULT_AGENT_MAX_STEPS,
  runAgentTurn,
  type ToolInvocationSummary,
} from "@/lib/ai/agent-run";

import { installSpacexFetchMock } from "../setup/spacex-fetch-mock";

const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEY);
const runJudge =
  hasOpenRouter && process.env.RUN_JUDGE === "1";

/** Next-launch lookups should use snapshot or filtered launch query only—not Starlink catalog, etc. */
const NEXT_LAUNCH_ALLOWED_TOOLS = new Set([
  "spacex_get_launch_snapshot",
  "spacex_query_launches",
]);

function assertOnlyNextLaunchSpacexTools(names: string[]) {
  const spacex = names.filter((n) => n.startsWith("spacex_"));
  expect(spacex.length).toBeGreaterThan(0);
  for (const n of spacex) {
    expect(NEXT_LAUNCH_ALLOWED_TOOLS.has(n)).toBe(true);
  }
}

function assertNextLaunchToolInputsMatchIntent(invocations: ToolInvocationSummary[]) {
  const relevant = invocations.filter(
    (i) =>
      i.toolName === "spacex_get_launch_snapshot" ||
      i.toolName === "spacex_query_launches",
  );
  expect(relevant.length).toBeGreaterThan(0);
  const ok = relevant.some((i) => {
    if (i.toolName === "spacex_get_launch_snapshot") {
      const input = i.input as { snapshot?: string };
      return input.snapshot === "next";
    }
    if (i.toolName === "spacex_query_launches") {
      const input = i.input as { upcoming?: boolean };
      return input.upcoming === true;
    }
    return false;
  });
  expect(ok).toBe(true);
}

function stringifyToolOutput(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

/** True when a tool step returned SpaceX `formatSpacexError` JSON (`"error": true`). */
function stepsIncludeSpacexToolError(
  steps: Array<{
    staticToolResults?: ReadonlyArray<{ output?: unknown }>;
    toolResults?: ReadonlyArray<{ output?: unknown }>;
  }>,
): boolean {
  for (const step of steps) {
    for (const tr of step.staticToolResults ?? []) {
      const s = stringifyToolOutput(tr.output);
      if (s.includes('"error"') && s.includes("true")) return true;
    }
    for (const tr of step.toolResults ?? []) {
      const s = stringifyToolOutput(tr.output);
      if (s.includes('"error"') && s.includes("true")) return true;
    }
  }
  return false;
}

/**
 * Paraphrases models use when acknowledging a failed lookup (matches prompt: tell the user plainly).
 * Kept broad to reduce flake vs. a single substring list.
 */
function assistantTextSuggestsLookupFailure(text: string): boolean {
  const t = text.toLowerCase();
  const needles = [
    "could not",
    "couldn't",
    "couldn’t",
    "can't",
    "cannot",
    "unable",
    "failed",
    "failure",
    "error",
    "unavailable",
    "not available",
    "problem",
    "issue",
    "trouble",
    "sorry",
    "did not load",
    "didn't load",
    "didn't get",
    "couldn't load",
    "couldn't fetch",
    "couldn't retrieve",
    "couldn't access",
    "lookup",
    "retrieve",
    "no data",
    "wasn't able",
    "weren't able",
    "isn't available",
    "aren't available",
    "don't have",
    "doesn't have",
    "haven't been able",
    "unable to",
    "did not respond",
    "didn't succeed",
  ];
  return needles.some((n) => t.includes(n));
}

describe.skipIf(!hasOpenRouter)("agent scenarios (OpenRouter + mocked SpaceX)", () => {
  describe("next launch uses fixture data", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("calls only launch snapshot or launch query tools, with next/upcoming intent, and mentions the fixture mission name", async () => {
      const result = await runAgentTurn({
        messages: [
          {
            role: "user",
            content:
              "What is the next scheduled SpaceX launch? Reply with the mission name.",
          },
        ],
      });

      expect(result.steps.length).toBeLessThanOrEqual(DEFAULT_AGENT_MAX_STEPS);
      const names = collectToolNames(result.steps);
      assertOnlyNextLaunchSpacexTools(names);
      assertNextLaunchToolInputsMatchIntent(collectToolInvocations(result.steps));
      expect(result.text.toLowerCase()).toContain("fixture starlink mission gamma");
    });
  });

  describe("company profile uses spacex_company", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("calls spacex_company and does not run launch lookup tools", async () => {
      const result = await runAgentTurn({
        messages: [
          {
            role: "user",
            content:
              "In which city is SpaceX headquarters located? Reply with the city name only.",
          },
        ],
      });

      expect(result.steps.length).toBeLessThanOrEqual(DEFAULT_AGENT_MAX_STEPS);
      const names = collectToolNames(result.steps);
      expect(names).toContain("spacex_company");
      expect(names).not.toContain("spacex_get_launch_snapshot");
      expect(names).not.toContain("spacex_query_launches");
      expect(names).not.toContain("spacex_resolve_rocket");
      expect(names).not.toContain("spacex_resolve_launchpad");
      expect(result.text.toLowerCase()).toContain("hawthorne");
    });
  });

  describe("Falcon Heavy test payload (Roadster / Starman)", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("names Roadster, Tesla, or Starman and uses SpaceX tools (prefer spacex_get_roadster)", async () => {
      const result = await runAgentTurn({
        messages: [
          {
            role: "user",
            content:
              "What is the name of the object SpaceX launched on the Falcon Heavy test flight that is now in heliocentric orbit? Reply with the short name only.",
          },
        ],
      });

      expect(result.steps.length).toBeLessThanOrEqual(DEFAULT_AGENT_MAX_STEPS);
      const names = collectToolNames(result.steps);
      expect(names.some((n) => n.startsWith("spacex_"))).toBe(true);
      expect(result.text.toLowerCase()).toMatch(/roadster|tesla|starman/);
    });
  });

  describe("ambiguous subject asks before guessing", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("does not call spacex_get_launch_snapshot on a vague pronoun question", async () => {
      const result = await runAgentTurn({
        messages: [
          {
            role: "user",
            content: "When did they launch?",
          },
        ],
      });

      expect(result.steps.length).toBeLessThanOrEqual(DEFAULT_AGENT_MAX_STEPS);
      const names = collectToolNames(result.steps);
      expect(names).not.toContain("spacex_get_launch_snapshot");
    });
  });

  describe("tool HTTP failure surfaces to the user", () => {
    installSpacexFetchMock({ mode: "post_launches_query_500" });

    it("does not pretend the launch lookup succeeded", async () => {
      const result = await runAgentTurn({
        messages: [
          {
            role: "user",
            content: "When is the next SpaceX launch?",
          },
        ],
      });

      expect(result.steps.length).toBeLessThanOrEqual(DEFAULT_AGENT_MAX_STEPS);
      expect(stepsIncludeSpacexToolError(result.steps)).toBe(true);
      expect(assistantTextSuggestsLookupFailure(result.text)).toBe(true);
    });
  });

  describe("off-topic deflection", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("does not invoke SpaceX catalog tools for unrelated questions", async () => {
      const result = await runAgentTurn({
        messages: [
          {
            role: "user",
            content: "What is the capital of France?",
          },
        ],
      });

      expect(result.steps.length).toBeLessThanOrEqual(DEFAULT_AGENT_MAX_STEPS);
      const names = collectToolNames(result.steps);
      expect(names.filter((n) => n.startsWith("spacex_"))).toEqual([]);
    });
  });
});

/**
 * Second LLM pass (`runAgentJudge`) scoring rubrics that are hard to encode as substrings.
 * Costs extra OpenRouter calls — enable with `RUN_JUDGE=1` (and `OPENROUTER_API_KEY`).
 */
describe.skipIf(!runJudge)("agent judge (RUN_JUDGE=1)", () => {
  describe("ambiguous subject — rubric", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("passes judge when the assistant clarifies instead of inventing a launch", async () => {
      const userMessage = "When did they launch?";
      const result = await runAgentTurn({
        messages: [{ role: "user", content: userMessage }],
      });

      const judge = await runAgentJudge({
        userMessage,
        assistantText: result.text,
        rubric: [
          "PASS if the assistant asks one or two specific clarifying questions (which mission, vehicle, or launch they mean) and does not assert a concrete launch date or mission as if it had identified the referent of 'they'.",
          "PASS if the assistant does not present a guessed launch as established fact.",
          "FAIL if the assistant gives a specific launch date, time, or mission name as the direct answer without first clarifying who or what 'they' refers to, when there is no prior thread context.",
        ].join("\n"),
      });

      assert.ok(judge.pass, judge.reason);
    });
  });

  describe("off-topic — rubric", () => {
    installSpacexFetchMock({ mode: "next_launch_ok" });

    it("passes judge when the assistant deflects to SpaceX scope", async () => {
      const userMessage = "What is the capital of France?";
      const result = await runAgentTurn({
        messages: [{ role: "user", content: userMessage }],
      });

      const judge = await runAgentJudge({
        userMessage,
        assistantText: result.text,
        rubric: [
          "PASS if the assistant politely says this assistant only answers SpaceX-related questions (or similar) and invites a SpaceX question, without treating the unrelated question as the main answer.",
          "FAIL if the assistant primarily answers the capital of France as a normal geography answer without redirecting to SpaceX scope.",
        ].join("\n"),
      });

      assert.ok(judge.pass, judge.reason);
    });
  });
});
