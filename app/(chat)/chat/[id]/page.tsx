import type { Id } from "@/convex/_generated/dataModel";
import { ChatShell } from "@/components/chat/chat-shell";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <ChatShell conversationId={id as Id<"conversations">} />;
}
