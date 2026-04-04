import type { InputHTMLAttributes } from "react";

type Props = {
  label: string;
  id?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function UnderlineInput({ label, id, className = "", ...rest }: Props) {
  const inputId = id ?? label.replace(/\s+/g, "-").toLowerCase();
  return (
    <label className="block w-full" htmlFor={inputId}>
      <span className="mb-2 block font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
        {label}
      </span>
      <input
        id={inputId}
        className={`h-11 w-full border-0 border-b border-[var(--border-1)] bg-transparent px-0 font-mono text-sm font-normal text-[var(--text-0)] placeholder:text-[var(--text-3)] focus:border-[var(--accent)] focus:outline-none ${className}`}
        {...rest}
      />
    </label>
  );
}
