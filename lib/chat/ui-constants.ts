/** Display label for the model row in the composer (optional env override). */
export const CHAT_MODEL_LABEL =
  process.env.NEXT_PUBLIC_CHAT_MODEL_LABEL ?? "OpenRouter";

export const STARTER_PROMPTS = [
  "When was the last SpaceX launch?",
  "What's the next SpaceX launch and where is it happening?",
  "How many launches did SpaceX complete in 2024?",
  "Which rocket was used for the Starlink 9-1 mission?",
  "Show me all successful Falcon 9 launches.",
  "What was the outcome of the first Falcon Heavy launch?",
  "Tell me about the most recent launch from Vandenberg.",
] as const;

export const STARTER_CHIPS: {
  label: string;
  icon: "rocket" | "calendar" | "satellite" | "map-pin";
  prompt: string;
}[] = [
  {
    label: "Last launch",
    icon: "rocket",
    prompt: "When was the last SpaceX launch?",
  },
  {
    label: "Next launch",
    icon: "calendar",
    prompt: "What's the next SpaceX launch and where is it happening?",
  },
  {
    label: "Falcon 9",
    icon: "satellite",
    prompt: "Show me all successful Falcon 9 launches.",
  },
  {
    label: "Vandenberg",
    icon: "map-pin",
    prompt: "Tell me about the most recent launch from Vandenberg.",
  },
];
