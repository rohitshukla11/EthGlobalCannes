"use client";

import { DEMO_ADVISOR_TEMPLATES } from "@/lib/demoAdvisorTemplates";
import { AdvisorMarketplaceCard } from "@/components/agents/AdvisorMarketplaceCard";
import { formatConsultationPrice } from "@/lib/advisorUi";

const FEATURED = DEMO_ADVISOR_TEMPLATES.slice(0, 3);

export function DemoAdvisorStrip() {
  return (
    <section className="mb-6">
      <p className="mb-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
        FEATURED
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {FEATURED.map((d) => {
          const pricing = { pricePerRequest: "0", currency: "eth-wei" as const };
          const priceLabel = formatConsultationPrice(pricing);
          const isFree = priceLabel === "Free";
          const href = `/?template=${encodeURIComponent(d.id)}`;
          return (
            <AdvisorMarketplaceCard
              key={d.id}
              variant="featured"
              name={d.specialization}
              profession={d.profession}
              specialization={d.specialization}
              experience={d.experience}
              pitch={d.pitch}
              verified={false}
              priceLabel={priceLabel}
              isFree={isFree}
              consultHref={href}
              profileHref={href}
            />
          );
        })}
      </div>
    </section>
  );
}
