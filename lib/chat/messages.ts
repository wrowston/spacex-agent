import type { UIMessage } from "ai";

type PersistedMessage = {
  _id: string;
  role: "user" | "assistant";
  text: string;
};

export function getTextFromUIMessage(message: Pick<UIMessage, "parts">) {
  let text = "";

  for (const part of message.parts) {
    if (part.type === "text") {
      text += part.text;
    }
  }

  return text.trim();
}

export function persistedMessagesToUIMessages(
  messages: PersistedMessage[],
): UIMessage[] {
  return messages.map((message) => ({
    id: message._id,
    role: message.role,
    parts: [{ type: "text", text: message.text }],
  }));
}
