import { ChatLayoutClient } from "@/components/chat/chat-layout-client";

export default function ChatGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatLayoutClient>{children}</ChatLayoutClient>;
}
