"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  children: string;
};

export function MarkdownBody({ children }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ node: _n, ...props }) => (
          <p className="mb-3 font-mono text-[13px] font-normal leading-[1.75] text-[var(--text-0)] last:mb-0" {...props} />
        ),
        strong: ({ node: _n, ...props }) => (
          <strong className="font-mono text-[13px] font-medium text-[var(--text-0)]" {...props} />
        ),
        ul: ({ node: _n, ...props }) => (
          <ul className="mb-3 list-disc pl-[18px] font-mono text-[13px] text-[var(--text-1)] last:mb-0" {...props} />
        ),
        ol: ({ node: _n, ...props }) => (
          <ol className="mb-3 list-decimal pl-[18px] font-mono text-[13px] text-[var(--text-1)] last:mb-0" {...props} />
        ),
        li: ({ node: _n, ...props }) => <li className="mb-1 font-mono text-[13px] text-[var(--text-1)]" {...props} />,
        code: ({ node: _n, className, children: c, ...props }) => {
          const isBlock = Boolean(className?.includes("language-"));
          if (isBlock) {
            return (
              <code
                className="mb-3 block rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.05)] p-3 font-mono text-xs text-[var(--accent)]"
                {...props}
              >
                {c}
              </code>
            );
          }
          return (
            <code
              className="rounded px-1 font-mono text-xs text-[var(--accent)] bg-[rgba(255,255,255,0.05)]"
              {...props}
            >
              {c}
            </code>
          );
        },
        hr: () => null,
        a: ({ node: _n, ...props }) => (
          <a className="text-[var(--accent)] underline-offset-2 hover:underline" {...props} />
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
