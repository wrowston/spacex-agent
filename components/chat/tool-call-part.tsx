"use client";

import { useMemo } from "react";
import type { DynamicToolUIPart, ToolUIPart, UITools, UIMessage } from "ai";
import { getToolName, isToolUIPart } from "ai";
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  spacex_get_launch_snapshot: "Launch Snapshot",
  spacex_query_launches: "Query Launches",
  spacex_resolve_rocket: "Resolve Rocket",
  spacex_resolve_launchpad: "Resolve Launchpad",
  spacex_company: "Company Info",
};

function humanizeToolName(rawName: string): string {
  return TOOL_DISPLAY_NAMES[rawName] ?? rawName.replace(/^spacex_/, "").replace(/_/g, " ");
}

function stringifyForDisplay(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max)}…`;
}

export type ToolPart = ToolUIPart<UITools> | DynamicToolUIPart;

type ToolCallPartProps = {
  part: ToolPart;
};

export function ToolCallPart({ part }: ToolCallPartProps) {
  const toolName = getToolName(part);
  const label = humanizeToolName(toolName);

  const { state } = part;
  const isLoading =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "approval-requested" ||
    state === "approval-responded";

  const outputText = useMemo(() => {
    if (state !== "output-available") return null;
    return stringifyForDisplay(part.output);
  }, [part, state]);

  const errorText = state === "output-error" ? part.errorText : null;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-xs shadow-sm",
        state === "output-error" && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
          {isLoading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : state === "output-error" ? (
            <AlertCircle className="size-3.5 text-destructive" />
          ) : state === "output-available" ? (
            <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <Wrench className="size-3.5" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium text-foreground">{label}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{toolName}</span>
          </div>
          {isLoading ? (
            <p className="text-muted-foreground">Calling {label}…</p>
          ) : null}
          {errorText ? (
            <p className="text-destructive">{errorText}</p>
          ) : null}
          {outputText !== null && outputText.length > 0 ? (
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-3.5 shrink-0 transition-transform group-open:rotate-180" />
                Show result
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-border/50 bg-background/80 p-2 font-mono text-[11px] leading-relaxed text-card-foreground">
                {truncate(outputText, 12000)}
              </pre>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function isRenderableToolPart(
  part: UIMessage["parts"][number],
): part is ToolPart {
  return isToolUIPart(part);
}
