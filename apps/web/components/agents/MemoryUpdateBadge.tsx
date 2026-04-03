"use client";

import { shortenRoot } from "@/lib/formatRoot";

type Props = {
  memoryRootBefore: string | null | undefined;
  memoryRootAfter: string | undefined;
  reflectionTriggered?: boolean;
};

export function MemoryUpdateBadge({ memoryRootBefore, memoryRootAfter, reflectionTriggered }: Props) {
  if (!memoryRootAfter) return null;
  const changed =
    memoryRootBefore != null && memoryRootAfter !== memoryRootBefore && memoryRootBefore !== "";

  return (
    <div className="mt-3 space-y-2 rounded-control border border-dim bg-black/40 px-3 py-2.5 font-mono text-[10px]">
      <p className="uppercase tracking-[0.12em] text-tertiary">Memory updated</p>
      <div className="space-y-1 text-secondary">
        <p>
          <span className="text-tertiary">Before:</span>{" "}
          <span className="break-all text-primary/90">{shortenRoot(memoryRootBefore ?? null, 8, 6)}</span>
        </p>
        <p>
          <span className="text-tertiary">After:</span>{" "}
          <span className="break-all text-accent">{shortenRoot(memoryRootAfter, 8, 6)}</span>
        </p>
      </div>
      {reflectionTriggered ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-success">
          <span aria-hidden>🧬</span> Agent evolved
        </span>
      ) : null}
      {!changed && memoryRootBefore ? (
        <p className="text-tertiary/80">Memory root unchanged this turn.</p>
      ) : null}
    </div>
  );
}
