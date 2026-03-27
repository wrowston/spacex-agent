import { describe, expect, it } from "vitest";
import type { StepResult } from "ai";

import {
  collectToolInvocations,
  collectToolNames,
} from "@/lib/ai/agent-run";
import { spacexTools } from "@/lib/ai/tools/spacex";

type SpacexStep = StepResult<typeof spacexTools>;

function step(toolCalls: SpacexStep["toolCalls"]): SpacexStep {
  return { toolCalls } as unknown as SpacexStep;
}

describe("collectToolInvocations", () => {
  it("returns empty array for empty steps", () => {
    expect(collectToolInvocations([])).toEqual([]);
  });

  it("returns empty array when steps have no tool calls", () => {
    expect(collectToolInvocations([step([])])).toEqual([]);
  });

  it("flattens a single step with one tool call and preserves input", () => {
    const input = { snapshot: "next" as const };
    const steps = [
      step([
        {
          type: "tool-call",
          toolCallId: "call-1",
          toolName: "spacex_get_launch_snapshot",
          input,
        } as SpacexStep["toolCalls"][number],
      ]),
    ];
    expect(collectToolInvocations(steps)).toEqual([
      { toolName: "spacex_get_launch_snapshot", input },
    ]);
  });

  it("flattens multiple tool calls in one step", () => {
    const steps = [
      step([
        {
          type: "tool-call",
          toolCallId: "a",
          toolName: "spacex_resolve_rocket",
          input: { nameContains: "Falcon", limit: 5 },
        } as SpacexStep["toolCalls"][number],
        {
          type: "tool-call",
          toolCallId: "b",
          toolName: "spacex_query_launches",
          input: { upcoming: true, limit: 1 },
        } as SpacexStep["toolCalls"][number],
      ]),
    ];
    expect(collectToolInvocations(steps)).toEqual([
      { toolName: "spacex_resolve_rocket", input: { nameContains: "Falcon", limit: 5 } },
      { toolName: "spacex_query_launches", input: { upcoming: true, limit: 1 } },
    ]);
  });

  it("concatenates tool calls across multiple steps", () => {
    const steps = [
      step([
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "spacex_company",
          input: {},
        } as SpacexStep["toolCalls"][number],
      ]),
      step([
        {
          type: "tool-call",
          toolCallId: "2",
          toolName: "spacex_get_roadster",
          input: {},
        } as SpacexStep["toolCalls"][number],
      ]),
    ];
    expect(collectToolInvocations(steps).map((t) => t.toolName)).toEqual([
      "spacex_company",
      "spacex_get_roadster",
    ]);
  });

  it("preserves duplicate tool names when the model calls the same tool twice", () => {
    const steps = [
      step([
        {
          type: "tool-call",
          toolCallId: "1",
          toolName: "spacex_query_launches",
          input: { upcoming: true, limit: 1 },
        } as SpacexStep["toolCalls"][number],
        {
          type: "tool-call",
          toolCallId: "2",
          toolName: "spacex_query_launches",
          input: { upcoming: false, limit: 1 },
        } as SpacexStep["toolCalls"][number],
      ]),
    ];
    expect(collectToolNames(steps)).toEqual([
      "spacex_query_launches",
      "spacex_query_launches",
    ]);
  });
});

describe("collectToolNames", () => {
  it("maps invocations to tool names only", () => {
    const steps = [
      step([
        {
          type: "tool-call",
          toolCallId: "x",
          toolName: "spacex_get_roadster",
          input: {},
        } as SpacexStep["toolCalls"][number],
      ]),
    ];
    expect(collectToolNames(steps)).toEqual(["spacex_get_roadster"]);
  });
});
