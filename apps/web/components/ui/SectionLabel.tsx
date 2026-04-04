type Props = { label: string; className?: string };

export function SectionLabel({ label, className = "" }: Props) {
  return (
    <p
      className={`font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)] ${className}`}
    >
      {label}
    </p>
  );
}
