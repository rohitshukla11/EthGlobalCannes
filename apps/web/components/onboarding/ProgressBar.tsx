"use client";

import { motion } from "framer-motion";

const STEPS = [
  { n: "01", label: "IDENTITY" },
  { n: "02", label: "WALLET" },
  { n: "03", label: "ADVISOR" },
] as const;

type Props = {
  step: number;
};

export function ProgressBar({ step }: Props) {
  return (
    <div className="flex h-12 shrink-0 border-t border-dim bg-void">
      {STEPS.map((s, i) => {
        const done = step > i;
        const current = step === i;
        return (
          <div key={s.label} className="flex flex-1 items-center px-4">
            <span
              className={`font-mono text-[10px] transition-colors duration-300 ${
                done || current ? "text-accent" : "text-tertiary"
              }`}
            >
              {s.n}
            </span>
            <div className="mx-3 h-px min-w-[12px] flex-1 overflow-hidden bg-mid/30">
              <motion.div
                className="h-full origin-left bg-accent"
                initial={false}
                animate={{ scaleX: done ? 1 : current ? 0.35 : 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <span
              className={`whitespace-nowrap font-mono text-[10px] tracking-[0.1em] transition-colors duration-300 ${
                current ? "text-primary" : done ? "text-secondary" : "text-tertiary"
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
