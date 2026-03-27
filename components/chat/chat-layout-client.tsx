"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ChatSidebar } from "./chat-sidebar";

export function ChatLayoutClient({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="chat-app bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-3 md:hidden">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-lg"
            onClick={() => setMobileOpen(true)}
            aria-label="Open threads"
          >
            <Menu className="size-5" />
          </Button>
          <span className="font-semibold tracking-tight">Orbital Chat</span>
        </div>

        <ChatSidebar
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
