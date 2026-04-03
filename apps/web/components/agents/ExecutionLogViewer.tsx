"use client";

import { useState } from "react";
import type { ExecutionLogPayload, ExecutionStepPayload } from "@/lib/agentTypes";

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
  if (s.kind === "tool_call" && s.tool) return `Calling tool: ${s.tool}`;
  if (s.kind === "tool_result") return "Tool result received";
  if (s.kind === "final") return "Final response";
  if (s.kind === "reasoning") return "Thinking…";
  return s.detail?.slice(0, 120) || "Step";
}

type Props = {
  executionLog: ExecutionLogPayload;
  defaultOpen?: boolean;
};

export function ExecutionLogViewer({ executionLog, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const steps = executionLog?.steps;
  if (!steps?.length) return null;

  return (
    <div className="mt-2 border-t border-dim/80 pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-control px-1 py-1.5 text-left font-mono text-[10px] uppercase tracking-[0.12em] text-accent transition-colors hover:bg-white/[0.04]"
        aria-expanded={open}
      >
        <span>View reasoning</span>
        <span className="text-tertiary">{open ? "−" : "+"}</span>
      </button>
      {open ? (
        <ol className="mt-2 space-y-2 border-l border-mid pl-3 font-mono text-[11px] text-secondary">
          {steps.map((s, i) => (
            <li key={`${s.step ?? i}-${i}`} className="leading-relaxed">
              <span className="mr-1.5" aria-hidden>
                {iconForStep(s)}
              </span>
              {labelForStep(s)}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
