import type { ExecutionStep } from "./types.js";
import { displayToolName } from "./toolLabels.js";

function clip(s: string, n: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

/** One-line human-readable label for demo / API visualization. */
export function summarizeStep(step: ExecutionStep): string {
  switch (step.kind) {
    case "reasoning":
      if (step.detail?.includes("No direct data")) return step.detail.slice(0, 160);
      return `Reasoning (step ${step.step}, ${step.durationMs ?? "?"}ms)`;
    case "tool_call": {
      const label = displayToolName(step.tool);
      return `🔧 Consulting ${label}…${step.detail ? ` ${clip(step.detail, 64)}` : ""}`;
    }
    case "tool_result": {
      const label = displayToolName(step.tool);
      const d = (step.detail ?? "").trim();
      if (!d || d === "(empty)" || d === '""')
        return `🔧 No direct data from ${label} — continuing with domain expertise`;
      return `🔧 Retrieved information via ${label}${d ? ` — ${clip(d, 88)}` : ""}`;
    }
    case "final":
      return `Response ready${step.detail ? ` — ${clip(step.detail, 100)}` : ""}`;
    default:
      return String(step.kind);
  }
}
