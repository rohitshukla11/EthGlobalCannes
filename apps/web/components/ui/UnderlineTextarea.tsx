import type { TextareaHTMLAttributes } from "react";

type Props = {
  label: string;
  id?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>;

export function UnderlineTextarea({ label, id, className = "", rows = 3, ...rest }: Props) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="block w-full" htmlFor={inputId}>
      <span className="mb-2 block font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
        {label}
      </span>
      <textarea
        id={inputId}
        rows={rows}
        className={`w-full resize-none border-0 border-b border-[var(--border-1)] bg-transparent px-0 py-2 font-mono text-sm font-normal text-[var(--text-0)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  );
}
