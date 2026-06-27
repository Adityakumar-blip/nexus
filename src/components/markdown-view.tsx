"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Lightweight markdown styling without the @tailwindcss/typography plugin —
// each element gets utility classes so notes read cleanly in light and dark.
export function MarkdownView({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={cn("text-sm leading-relaxed", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ ...p }) => (
            <h1 className="mt-6 mb-3 text-2xl font-semibold first:mt-0" {...p} />
          ),
          h2: ({ ...p }) => (
            <h2 className="mt-6 mb-2 text-xl font-semibold first:mt-0" {...p} />
          ),
          h3: ({ ...p }) => (
            <h3 className="mt-4 mb-2 text-lg font-semibold first:mt-0" {...p} />
          ),
          p: ({ ...p }) => <p className="my-3 leading-relaxed" {...p} />,
          a: ({ href, ...p }) => {
            // Internal deep-links (e.g. /projects/abc?task=123) stay in-app and
            // open in the same tab; external links open in a new one.
            const internal = typeof href === "string" && href.startsWith("/");
            return (
              <a
                href={href}
                className="text-primary font-medium underline underline-offset-4"
                {...(internal ? {} : { target: "_blank", rel: "noreferrer" })}
                {...p}
              />
            );
          },
          ul: ({ ...p }) => (
            <ul className="my-3 list-disc space-y-1 pl-6" {...p} />
          ),
          ol: ({ ...p }) => (
            <ol className="my-3 list-decimal space-y-1 pl-6" {...p} />
          ),
          li: ({ ...p }) => <li className="leading-relaxed" {...p} />,
          blockquote: ({ ...p }) => (
            <blockquote
              className="text-muted-foreground my-3 border-l-2 pl-4 italic"
              {...p}
            />
          ),
          code: ({ className: c, children, ...rest }) => {
            const isBlock = /language-/.test(c ?? "");
            if (isBlock) {
              return (
                <code
                  className="font-mono text-[13px]"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="bg-muted rounded px-1.5 py-0.5 font-mono text-[13px]"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: ({ ...p }) => (
            <pre
              className="bg-muted my-3 overflow-x-auto rounded-lg p-4"
              {...p}
            />
          ),
          hr: ({ ...p }) => <hr className="my-6" {...p} />,
          table: ({ ...p }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...p} />
            </div>
          ),
          th: ({ ...p }) => (
            <th
              className="border px-3 py-1.5 text-left font-semibold"
              {...p}
            />
          ),
          td: ({ ...p }) => <td className="border px-3 py-1.5" {...p} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
