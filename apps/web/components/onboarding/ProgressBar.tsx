"use client";

import { motion } from "framer-motion";

const STEPS = [
  { n: "01", label: "HUMANITY" },
  { n: "02", label: "WALLET" },
  { n: "03", label: "ADVISOR" },
] as const;

type Props = {
  step: number;
};

export function ProgressBar({ step }: Props) {
  return (
    <div className="fixed bottom-0 left-[var(--sidebar-w)] right-0 z-30 flex h-11 border-t border-[var(--border-0)] bg-[var(--bg-0)]">
      {STEPS.map((s, i) => {
        const done = step > i;
        const current = step === i;
        return (
          <div key={s.label} className="flex flex-1 items-center gap-2.5 px-6">
            <span
              className={`shrink-0 font-mono text-[10px] font-normal ${
                done ? "text-[var(--success)]" : current ? "text-[var(--accent)]" : "text-[var(--text-2)]"
              }`}
            >
              {s.n}
            </span>
            <div className="relative h-px min-w-[12px] flex-1 overflow-hidden bg-[var(--border-1)]">
              <motion.div
                className="absolute inset-y-0 left-0 h-full origin-left bg-[var(--accent)]"
                initial={false}
                animate={{ scaleX: done ? 1 : 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                style={{ width: "100%" }}
              />
            </div>
            <span
              className={`whitespace-nowrap font-mono text-[10px] font-normal tracking-[0.08em] ${
                current ? "text-[var(--text-0)]" : done ? "text-[var(--text-1)]" : "text-[var(--text-2)]"
              }`}
            >
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
