"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { Loader2 } from "lucide-react";

import { api } from "@/convex/_generated/api";

export default function Home() {
  const createConversation = useMutation(api.conversations.createConversation);
  const router = useRouter();
  const hasStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const conversationId = await createConversation();

        if (!cancelled) {
          router.replace(`/chat/${conversationId}`);
        }
      } catch (caughtError) {
        if (!cancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Unable to create a new conversation.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [createConversation, router]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16">
      {error ? (
        <p className="max-w-md text-center text-sm text-destructive">{error}</p>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Starting a new chat…</p>
        </>
      )}
    </div>
  );
}
