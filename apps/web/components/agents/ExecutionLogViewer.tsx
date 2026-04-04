"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ExecutionLogPayload, ExecutionStepPayload } from "@/lib/agentTypes";
import { displayToolName } from "@/lib/toolDisplayNames";

function iconForStep(s: ExecutionStepPayload): string {
  const k = s.kind ?? "";
  if (k === "reasoning") return "🧠";
  if (k === "tool_call") return "🔧";
  if (k === "tool_result") return "📦";
  if (k === "final") return "💬";
  return "·";
}

function labelForStep(s: ExecutionStepPayload): string {
  if (s.shortSummary?.trim()) return s.shortSummary.trim();
  if (s.kind === "tool_call" && s.tool) {
    return `Consulting ${displayToolName(s.tool)}…`;
  }
  if (s.kind === "tool_result") {
    return `Retrieved information via ${displayToolName(s.tool)}`;
  }
  if (s.kind === "final") return "Response ready";
  if (s.kind === "reasoning") return "Reasoning…";
  return s.detail?.slice(0, 120) || "Step";
}

function isTrainingFetchStep(s: ExecutionStepPayload): boolean {
  return Boolean(
    s.shortSummary?.startsWith("Fetching training doc") || s.detail?.startsWith("Fetching training doc")
  );
}

function stepShell(kind: string): string {
  if (kind === "reasoning") return "border-l-2 border-[#7F77DD] bg-[rgba(127,119,221,0.04)]";
  if (kind === "tool_call") return "border-l-2 border-[#BA7517] bg-[rgba(186,117,23,0.04)]";
  if (kind === "tool_result") return "border-l-2 border-[#1D9E75] bg-[rgba(29,158,117,0.04)]";
  if (kind === "final") return "border-l-2 border-[var(--success)] bg-[var(--success-dim)]";
  return "border-l-2 border-[var(--border-2)] bg-[var(--bg-1)]";
}

type Props = {
  executionLog: ExecutionLogPayload;
  defaultOpen?: boolean;
};

export function ExecutionLogViewer({ executionLog, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const rag = executionLog?.ragSources ?? [];
  const rawSteps = executionLog?.steps ?? [];
  const steps = rawSteps.filter((s) => !isTrainingFetchStep(s));

  if (!rag.length && !steps.length) return null;

  return (
    <div className="mt-2.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-mono text-[11px] font-normal text-[var(--text-2)] transition-colors duration-150 hover:text-[var(--text-1)]"
        aria-expanded={open}
      >
        {open ? "▾ " : "▸ "}
        VIEW REASONING
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] p-3">
              {rag.map((s, i) => (
                <div
                  key={`rag-${s.hash}-${i}`}
                  className="rounded-r-[var(--radius-sm)] border-l-2 border-[var(--accent)] bg-[var(--accent-dim)] px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[var(--text-1)]"
                >
                  <span aria-hidden>📄</span> doc: {s.filename} ·{" "}
                  {s.hash.length > 14 ? `${s.hash.slice(0, 6)}…${s.hash.slice(-4)}` : s.hash}
                </div>
              ))}
              {steps.map((s, i) => (
                <div
                  key={`${s.step ?? i}-${i}`}
                  className={`rounded-r-[var(--radius-sm)] px-2.5 py-2 font-mono text-[11px] leading-relaxed text-[var(--text-1)] ${stepShell(s.kind ?? "")}`}
                >
                  <span aria-hidden>{iconForStep(s)}</span> {labelForStep(s)}
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
