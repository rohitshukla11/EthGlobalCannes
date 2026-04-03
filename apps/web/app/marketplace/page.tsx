import { Suspense } from "react";
import { MarketplaceExplore } from "@/components/agents/MarketplaceExplore";

export const dynamic = "force-dynamic";

function MarketplaceFallback() {
  return <p className="py-20 text-center font-mono text-[13px] text-tertiary">Loading…</p>;
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={<MarketplaceFallback />}>
      <MarketplaceExplore />
    </Suspense>
  );
}
