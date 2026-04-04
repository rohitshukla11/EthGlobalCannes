"use client";

import type { MarketplaceAgent } from "@/lib/agentTypes";
import { formatConsultationPrice, formatProfessionLabel } from "@/lib/advisorUi";
import { AdvisorMarketplaceCard } from "@/components/agents/AdvisorMarketplaceCard";

type Props = {
  agent: MarketplaceAgent;
  active?: boolean;
};

export function AgentCard({ agent }: Props) {
  const profession = agent.profession?.trim() || "Advisor";
  const professionLabel = formatProfessionLabel(agent.profession);
  const specialization = agent.specialization?.trim() || professionLabel;
  const experience = agent.experience?.trim() || "";
  const pitch =
    agent.expertise?.trim() ||
    agent.personality?.trim() ||
    "Consultation-grade AI on 0G — memory and proofs per session.";
  const priceLabel = formatConsultationPrice(agent.pricing ?? null);
  const isFree = priceLabel === "Free";

  return (
    <AdvisorMarketplaceCard
      variant="grid"
      name={agent.name}
      profession={profession}
      specialization={specialization}
      experience={experience}
      pitch={pitch}
      verified={Boolean(agent.verifiedHumanTwin)}
      priceLabel={priceLabel}
      isFree={isFree}
      consultHref={`/agent/${encodeURIComponent(agent.ensFullName)}/interact`}
      profileHref={`/agent/${encodeURIComponent(agent.id)}`}
    />
  );
}
