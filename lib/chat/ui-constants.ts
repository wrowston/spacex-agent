/** Display label for the model row in the composer (optional env override). */
export const CHAT_MODEL_LABEL =
  process.env.NEXT_PUBLIC_CHAT_MODEL_LABEL ?? "OpenRouter";

export const STARTER_PROMPTS = [
  "How does AI work?",
  "What is the meaning of life?",
  "How many Rs are in the word \"strawberry\"?",
  "Explain async/await in JavaScript.",
] as const;

export const STARTER_CHIPS: {
  label: string;
  icon: "sparkles" | "compass" | "code" | "graduation-cap";
  prompt: string;
}[] = [
  {
    label: "Create",
    icon: "sparkles",
    prompt: "Help me brainstorm ideas for a small side project.",
  },
  {
    label: "Explore",
    icon: "compass",
    prompt: "What are interesting topics I could learn about this week?",
  },
  {
    label: "Code",
    icon: "code",
    prompt: "Review this approach and suggest improvements.",
  },
  {
    label: "Learn",
    icon: "graduation-cap",
    prompt: "Teach me the basics of a topic in simple terms.",
  },
];
