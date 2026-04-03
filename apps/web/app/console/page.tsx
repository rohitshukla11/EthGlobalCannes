"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AgentConsole } from "@/components/agents/AgentConsole";

function ConsoleInner() {
  const sp = useSearchParams();
  const ens = sp.get("ens") ?? "";

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold leading-none text-primary">Console</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          Live OpenClaw loop — reasoning, tools, and memory roots surface after each turn. No page reloads.
        </p>
      </header>
      <AgentConsole initialEns={ens} />
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense
      fallback={<p className="font-mono text-[13px] text-tertiary">Loading console…</p>}
    >
      <ConsoleInner />
    </Suspense>
  );
}
