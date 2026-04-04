"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type SelectOption<T extends string = string> = { value: T; label: string };

type Props<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: SelectOption<T>[];
  "aria-label": string;
  widthClass?: string;
};

export function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  widthClass = "w-[180px]",
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={root} className={`relative shrink-0 ${widthClass}`}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] px-3.5 font-mono text-[13px] font-normal text-[var(--text-1)] transition-colors hover:border-[var(--border-2)] focus:border-[var(--border-3)] focus:outline-none"
      >
        <span className="min-w-0 truncate text-left">{current}</span>
        <ChevronDown className="size-4 shrink-0 text-[var(--text-2)]" strokeWidth={1.5} aria-hidden />
      </button>
      {open ? (
        <ul
          className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-60 overflow-auto rounded-[var(--radius-sm)] border border-[var(--border-2)] bg-[var(--bg-2)] py-1 shadow-none"
          role="listbox"
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                className={`flex h-9 w-full items-center px-3 text-left font-mono text-[13px] transition-colors ${
                  o.value === value
                    ? "bg-[var(--bg-3)] text-[var(--text-0)]"
                    : "text-[var(--text-1)] hover:bg-[var(--bg-3)] hover:text-[var(--text-0)]"
                }`}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
