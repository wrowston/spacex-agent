"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

type ChatMessageMarkdownProps = {
  content: string;
  variant: "user" | "assistant";
};

function buildComponents(variant: "user" | "assistant"): Components {
  const isUser = variant === "user";

  return {
    p: ({ children, ...props }) => (
      <p
        className={cn("mb-3 text-sm leading-relaxed last:mb-0", isUser && "text-primary-foreground")}
        {...props}
      >
        {children}
      </p>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),
    ul: ({ children, ...props }) => (
      <ul
        className={cn(
          "mb-3 list-disc pl-5 text-sm leading-relaxed last:mb-0 [&>li]:mt-1",
          isUser && "text-primary-foreground marker:text-primary-foreground/80",
        )}
        {...props}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        className={cn(
          "mb-3 list-decimal pl-5 text-sm leading-relaxed last:mb-0 [&>li]:mt-1",
          isUser && "text-primary-foreground marker:text-primary-foreground/80",
        )}
        {...props}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="text-sm leading-relaxed" {...props}>
        {children}
      </li>
    ),
    a: ({ children, href, ...props }) => (
      <a
        href={href}
        className={cn(
          "underline underline-offset-2 transition-opacity hover:opacity-80",
          isUser ? "text-primary-foreground" : "text-foreground",
        )}
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    code: ({ className, children, ...props }) => {
      const isBlock = className?.includes("language-");
      if (isBlock) {
        return (
          <code className={cn("font-mono text-[0.8125rem]", className)} {...props}>
            {children}
          </code>
        );
      }
      return (
        <code
          className={cn(
            "rounded px-1 py-0.5 font-mono text-[0.8125rem]",
            isUser
              ? "bg-primary-foreground/15 text-primary-foreground"
              : "bg-muted text-foreground",
          )}
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children, ...props }) => (
      <pre
        className={cn(
          "mb-3 overflow-x-auto rounded-lg p-3 font-mono text-[0.8125rem] leading-relaxed last:mb-0",
          isUser ? "bg-primary-foreground/10 text-primary-foreground" : "bg-muted text-card-foreground",
        )}
        {...props}
      >
        {children}
      </pre>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        className={cn(
          "mb-3 border-l-2 pl-3 text-sm leading-relaxed last:mb-0",
          isUser ? "border-primary-foreground/40 text-primary-foreground/90" : "border-border text-muted-foreground",
        )}
        {...props}
      >
        {children}
      </blockquote>
    ),
    h1: ({ children, ...props }) => (
      <h1 className="mb-2 text-base font-semibold tracking-tight last:mb-0" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="mb-2 text-base font-semibold tracking-tight last:mb-0" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="mb-2 text-sm font-semibold tracking-tight last:mb-0" {...props}>
        {children}
      </h3>
    ),
    hr: (props) => (
      <hr
        className={cn("my-3 border-0 border-t", isUser ? "border-primary-foreground/25" : "border-border")}
        {...props}
      />
    ),
    table: ({ children, ...props }) => (
      <div className="mb-3 overflow-x-auto last:mb-0">
        <table className="w-full min-w-[12rem] border-collapse text-left text-sm" {...props}>
          {children}
        </table>
      </div>
    ),
    thead: (props) => <thead className={cn(!isUser && "bg-muted/60")} {...props} />,
    th: ({ children, ...props }) => (
      <th
        className={cn(
          "border px-2 py-1.5 font-semibold",
          isUser ? "border-primary-foreground/25" : "border-border",
        )}
        {...props}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        className={cn(
          "border px-2 py-1.5 align-top",
          isUser ? "border-primary-foreground/25" : "border-border",
        )}
        {...props}
      >
        {children}
      </td>
    ),
    tr: (props) => <tr {...props} />,
    tbody: (props) => <tbody {...props} />,
    del: ({ children, ...props }) => (
      <del className="line-through opacity-80" {...props}>
        {children}
      </del>
    ),
    input: ({ ...props }) => (
      <input className="mr-2 align-middle" type="checkbox" disabled {...props} />
    ),
  };
}

export function ChatMessageMarkdown({ content, variant }: ChatMessageMarkdownProps) {
  const components = buildComponents(variant);

  return (
    <div className={cn("text-sm leading-relaxed", variant === "user" && "text-primary-foreground")}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
