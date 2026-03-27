"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Loader2, MessageSquarePlus, Search, X } from "lucide-react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function groupByRecency(
  items: Array<{ _id: Id<"conversations">; title: string; updatedAt: number }>,
  now: number,
) {
  const cutoff = now - WEEK_MS;
  const recent: typeof items = [];
  const older: typeof items = [];

  for (const item of items) {
    if (item.updatedAt >= cutoff) {
      recent.push(item);
    } else {
      older.push(item);
    }
  }

  return { recent, older };
}

type ChatSidebarProps = {
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export function ChatSidebar({ mobileOpen, onMobileClose }: ChatSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const createConversation = useMutation(api.conversations.createConversation);
  const conversations = useQuery(api.conversations.listConversations);
  const [query, setQuery] = useState("");
  const [newChatPending, setNewChatPending] = useState(false);

  async function handleNewChat() {
    if (newChatPending) {
      return;
    }

    setNewChatPending(true);

    try {
      const conversationId = await createConversation();
      onMobileClose();
      router.push(`/chat/${conversationId}`);
    } finally {
      setNewChatPending(false);
    }
  }

  const filtered = useMemo(() => {
    if (!conversations) {
      return [];
    }

    const q = query.trim().toLowerCase();

    if (!q) {
      return conversations;
    }

    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, query]);

  const { recent, older } = useMemo(
    () => groupByRecency(filtered, Date.now()),
    [filtered],
  );

  const activeId = pathname?.startsWith("/chat/")
    ? (pathname.split("/")[2] as Id<"conversations"> | undefined)
    : undefined;

  function threadLink(id: Id<"conversations">, title: string) {
    const active = activeId === id;

    return (
      <Link
        key={id}
        href={`/chat/${id}`}
        onClick={onMobileClose}
        className={cn(
          "block truncate rounded-lg px-3 py-2 text-left text-sm transition-colors",
          active
            ? "bg-primary/15 font-medium text-foreground"
            : "text-foreground/80 hover:bg-muted/80",
        )}
        title={title}
      >
        {title}
      </Link>
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/25 md:hidden"
          aria-label="Close menu"
          onClick={onMobileClose}
        />
      ) : null}

      <aside
        className={cn(
          "flex w-[280px] shrink-0 flex-col border-border/60 bg-sidebar",
          "md:relative md:z-0 md:flex md:translate-x-0 md:border-r",
          mobileOpen
            ? "fixed inset-y-0 left-0 z-50 flex border-r shadow-xl"
            : "hidden md:flex",
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col pt-4">
          <div className="px-3 pb-3">
            <Button
              type="button"
              className="h-10 w-full justify-center gap-2 rounded-xl font-medium shadow-sm"
              disabled={newChatPending}
              onClick={() => void handleNewChat()}
            >
              {newChatPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <MessageSquarePlus className="size-4" />
              )}
              New chat
            </Button>
          </div>

          <div className="relative px-3 pb-3">
            <Search className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your threads…"
              className="h-10 w-full rounded-xl border border-border/80 bg-background/80 pl-10 pr-3 text-sm outline-none ring-primary/30 placeholder:text-muted-foreground focus-visible:ring-2"
            />
          </div>

          <ScrollArea className="min-h-0 flex-1 px-2">
            <div className="space-y-4 pb-4">
              {conversations === undefined ? (
                <div className="space-y-2 px-2">
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                  <Skeleton className="h-9 w-full rounded-lg" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {query.trim()
                    ? "No threads match your search."
                    : "No chats yet."}
                </p>
              ) : (
                <>
                  {recent.length > 0 ? (
                    <div>
                      <p className="px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Last 7 days
                      </p>
                      <div className="space-y-0.5">
                        {recent.map((c) => threadLink(c._id, c.title))}
                      </div>
                    </div>
                  ) : null}
                  {older.length > 0 ? (
                    <div>
                      <p className="px-3 pb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Older
                      </p>
                      <div className="space-y-0.5">
                        {older.map((c) => threadLink(c._id, c.title))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {mobileOpen ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-3 right-2 md:hidden"
            onClick={onMobileClose}
            aria-label="Close"
          >
            <X className="size-5" />
          </Button>
        ) : null}
      </aside>
    </>
  );
}
