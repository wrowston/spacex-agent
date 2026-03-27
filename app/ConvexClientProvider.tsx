"use client";

import type { ReactNode } from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convexClient) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-10">
        <Card className="w-full max-w-xl border border-border/70 bg-card/90 shadow-2xl shadow-black/20 backdrop-blur">
          <CardHeader>
            <CardTitle>Convex is not configured</CardTitle>
            <CardDescription>
              Add `NEXT_PUBLIC_CONVEX_URL` to `.env.local` and run `bunx convex
              dev` before starting the app.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            The chat UI relies on Convex for conversation storage, live queries,
            and new-thread creation.
          </CardContent>
        </Card>
      </main>
    );
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
