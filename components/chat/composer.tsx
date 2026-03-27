"use client";

import type { ChatStatus } from "ai";
import { ArrowUp, Loader2, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ComposerProps = {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: ChatStatus;
};

export function Composer({
  input,
  onInputChange,
  onSubmit,
  onStop,
  status,
}: ComposerProps) {
  const isWorking = status !== "ready";

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative rounded-2xl border border-border/80 bg-card/90 shadow-sm">
        <Textarea
          value={input}
          onChange={(event) => onInputChange(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          rows={3}
          placeholder="Ask about SpaceX launches, missions, or vehicles…"
          className="min-h-[5.5rem] resize-none border-0 bg-transparent px-4 pt-3.5 pb-14 text-sm leading-relaxed shadow-none focus-visible:ring-0"
        />
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-end gap-2">
          <div className="pointer-events-auto flex items-center gap-2">
            {isWorking ? (
              <Button type="button" variant="outline" size="sm" onClick={onStop}>
                <Square className="size-3.5" />
                Stop
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              className="size-10 rounded-full shadow-sm"
              onClick={onSubmit}
              disabled={isWorking || !input.trim()}
              aria-label="Send message"
            >
              {isWorking ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <ArrowUp className="size-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
