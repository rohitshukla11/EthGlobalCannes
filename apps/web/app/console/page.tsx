"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AgentConsole } from "@/components/agents/AgentConsole";

function ConsoleInner() {
  const sp = useSearchParams();
  const ens = sp.get("ens") ?? "";
  const hasEns = Boolean(ens.trim());

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-extrabold leading-none text-primary">Console</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          Consult professional advisors live — OpenClaw reasoning, tools, and 0G memory roots after each turn.
        </p>
      </header>
      {!hasEns ? (
        <div className="rounded-ui border border-dim bg-raised/60 px-4 py-3 font-mono text-[12px] leading-relaxed text-secondary">
          <span className="text-primary">Enter an advisor&apos;s ENS</span> below, or{" "}
          <Link href="/marketplace" className="text-accent no-underline hover:underline">
            explore advisors
          </Link>
          .
        </div>
      ) : null}
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
