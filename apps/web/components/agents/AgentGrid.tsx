"use client";

import type { MarketplaceAgent } from "@/lib/agentTypes";
import { AgentCard } from "./AgentCard";

type Props = {
  agents: MarketplaceAgent[];
  activeEns?: string | null;
};

export function AgentGrid({ agents, activeEns }: Props) {
  if (!agents.length) {
    return (
      <p className="py-16 text-center font-mono text-[13px] text-tertiary">
        No agents match your filters.
      </p>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((a) => (
        <AgentCard key={a.id} agent={a} active={activeEns != null && a.ensFullName === activeEns} />
      ))}
    </div>
  );
}
