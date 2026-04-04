"use client";

import { motion } from "framer-motion";
import type { MarketplaceAgent } from "@/lib/agentTypes";
import { AgentCard } from "./AgentCard";
import { GhostButton } from "@/components/ui/GhostButton";

type Props = {
  agents: MarketplaceAgent[];
  activeEns?: string | null;
  onClearFilters?: () => void;
};

const container = {
  hidden: { opacity: 1 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0, 0, 0.2, 1] as const },
  },
};

export function AgentGrid({ agents, activeEns, onClearFilters }: Props) {
  if (!agents.length) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-4">
        <p className="font-mono text-[13px] font-normal text-[var(--text-2)]">No advisors match your search</p>
        {onClearFilters ? (
          <GhostButton label="Clear filters" onClick={onClearFilters} size="sm" className="w-auto min-w-[140px] px-4" />
        ) : null}
      </div>
    );
  }

  return (
    <motion.div
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {agents.map((a) => (
        <motion.div key={a.id} variants={item} className="h-full">
          <AgentCard agent={a} active={activeEns != null && a.ensFullName === activeEns} />
        </motion.div>
      ))}
    </motion.div>
  );
}
