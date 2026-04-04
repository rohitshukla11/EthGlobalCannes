"use client";

import { useCallback, useState } from "react";
import { Copy } from "lucide-react";

function truncateHash(hash: string): string {
  const h = hash.trim();
  if (h.length <= 14) return h;
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

type Props = {
  hash: string;
  label?: string;
  showCopy?: boolean;
  valueClassName?: string;
};

export function HashDisplay({ hash, label, showCopy = true, valueClassName = "" }: Props) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    if (!hash || !showCopy) return;
    void navigator.clipboard.writeText(hash).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }, [hash, showCopy]);

  return (
    <div className="group flex flex-col gap-1">
      {label ? (
        <span className="font-mono text-[10px] font-normal text-[var(--text-2)]">{label}</span>
      ) : null}
      <div className="flex items-center gap-2">
        <span
          className={`min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--text-1)] ${valueClassName}`}
          title={hash}
        >
          {truncateHash(hash)}
        </span>
        {showCopy ? (
          <button
            type="button"
            onClick={copy}
            className="shrink-0 rounded-[var(--radius-sm)] p-1 text-[var(--text-2)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-[var(--text-0)] focus:opacity-100"
            aria-label="Copy hash"
          >
            {copied ? (
              <span className="font-mono text-[10px] text-[var(--success)]">Copied!</span>
            ) : (
              <Copy className="size-3.5" strokeWidth={1.5} aria-hidden />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
