"use client";

import {
  BookOpen,
  Braces,
  Compass,
  GraduationCap,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { STARTER_CHIPS, STARTER_PROMPTS } from "@/lib/chat/ui-constants";
import { cn } from "@/lib/utils";

const chipIcons = {
  sparkles: Sparkles,
  compass: Compass,
  code: Braces,
  "graduation-cap": GraduationCap,
} as const;

type ChatEmptyStateProps = {
  onFillInput: (text: string) => void;
};

export function ChatEmptyState({ onFillInput }: ChatEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
      <p className="text-center text-2xl font-medium tracking-tight sm:text-3xl">
        How can I help you today?
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {STARTER_CHIPS.map((chip) => {
          const Icon = chipIcons[chip.icon];

          return (
            <Button
              key={chip.label}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-border/80 bg-background/60"
              onClick={() => onFillInput(chip.prompt)}
            >
              <Icon className="size-4" />
              {chip.label}
            </Button>
          );
        })}
      </div>

      <div className="mt-10 w-full max-w-md">
        <p className="mb-3 flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <BookOpen className="size-3.5" />
          Try asking
        </p>
        <div className="rounded-2xl border border-border/70 bg-background/50">
          {STARTER_PROMPTS.map((prompt, i) => (
            <div key={prompt}>
              {i > 0 ? <Separator className="bg-border/60" /> : null}
              <button
                type="button"
                onClick={() => onFillInput(prompt)}
                className={cn(
                  "w-full px-4 py-3 text-left text-sm text-foreground/90 transition-colors",
                  "hover:bg-muted/60",
                )}
              >
                {prompt}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
