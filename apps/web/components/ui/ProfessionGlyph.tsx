import { professionEmoji } from "@/lib/advisorUi";

type Size = "sm" | "md" | "lg";

const px: Record<Size, string> = {
  sm: "size-6 text-[14px]",
  md: "size-9 text-[18px]",
  lg: "size-10 text-[20px]",
};

type Props = {
  profession: string;
  size?: Size;
  className?: string;
};

export function ProfessionGlyph({ profession, size = "md", className = "" }: Props) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--accent-mid)] bg-[var(--accent-dim)] ${px[size]} ${className}`}
      aria-hidden
    >
      <span>{professionEmoji(profession)}</span>
    </div>
  );
}
