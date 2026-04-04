import { Suspense } from "react";
import { MarketplaceExplore } from "@/components/agents/MarketplaceExplore";

export const dynamic = "force-dynamic";

function AgentsFallback() {
  return <p className="py-20 text-center font-mono text-[13px] text-tertiary">Loading…</p>;
}

/** Alias URL for Explore Agents (`/marketplace` and `/agents` share the same UI). */
export default function AgentsPage() {
  return (
    <Suspense fallback={<AgentsFallback />}>
      <MarketplaceExplore />
    </Suspense>
  );
}
