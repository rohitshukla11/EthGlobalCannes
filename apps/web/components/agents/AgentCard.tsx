"use client";

import Link from "next/link";
import type { MarketplaceAgent } from "@/lib/agentTypes";
import { shortenRoot } from "@/lib/formatRoot";
import { formatConsultationPrice, professionEmoji } from "@/lib/advisorUi";

type Props = {
  agent: MarketplaceAgent;
  active?: boolean;
};

export function AgentCard({ agent, active }: Props) {
  const profession = agent.profession?.trim() || "Advisor";
  const emoji = professionEmoji(profession);
  const specialization = agent.specialization?.trim() || "Professional advisory";
  const experience = agent.experience?.trim() || "";
  const pitch =
    agent.expertise?.trim() ||
    agent.personality?.trim() ||
    "Consultation-grade AI on 0G — memory and proofs per session.";

  return (
    <article
      className={`tile-glow group relative flex h-full flex-col rounded-ui border bg-[rgba(17,17,16,0.72)] p-5 shadow-[inset_0_1px_0_rgba(232,255,90,0.06)] backdrop-blur-sm transition-[border-color,box-shadow] duration-200 ease-out ${
        active
          ? "border-[rgba(232,255,90,0.55)] shadow-[0_0_24px_rgba(232,255,90,0.12)]"
          : "border-dim hover:border-[rgba(232,255,90,0.28)] hover:shadow-[0_0_20px_rgba(232,255,90,0.06)]"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-accent">
            <span className="mr-1" aria-hidden>
              {emoji}
            </span>
            {profession}
          </p>
          <h3 className="mt-1 font-mono text-[15px] font-medium text-primary">{specialization}</h3>
          <p className="mt-1 font-mono text-[12px] text-secondary">{agent.ensFullName}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {agent.openClawAgent ? (
              <span className="rounded-full border border-[rgba(232,255,90,0.45)] bg-[rgba(232,255,90,0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                OpenClaw
              </span>
            ) : null}
            {agent.verifiedHumanTwin ? (
              <span className="rounded-full border border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-success">
                Human verified
              </span>
            ) : null}
          </div>
        </div>
        <span className="shrink-0 rounded-control border border-dim px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-tertiary">
          iNFT #{agent.tokenId}
        </span>
      </div>

      {experience ? (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-tertiary">{experience}</p>
      ) : null}

      <p className="mt-3 line-clamp-3 min-h-[3.25rem] font-mono text-[12px] leading-relaxed text-secondary">
        &ldquo;{pitch}&rdquo;
      </p>

      <p className="mt-4 font-mono text-[11px] text-secondary">
        <span className="text-tertiary">Consultation: </span>
        {formatConsultationPrice(agent.pricing ?? null)}
      </p>

      <dl className="mt-4 space-y-1 border-t border-dim pt-4 font-mono text-[10px] text-tertiary">
        <div className="flex justify-between gap-2">
          <dt>Config root</dt>
          <dd className="max-w-[58%] break-all text-right text-secondary">{shortenRoot(agent.configRoot, 6, 4)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Memory head</dt>
          <dd className="max-w-[58%] break-all text-right text-secondary">{shortenRoot(agent.memoryHead, 6, 4)}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Link
          href={`/agent/${encodeURIComponent(agent.id)}`}
          className="inline-flex h-9 flex-1 min-w-[120px] items-center justify-center rounded-control border border-mid bg-transparent font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-primary no-underline transition-colors hover:border-accent hover:text-accent"
        >
          Profile
        </Link>
        <Link
          href={`/agent/${encodeURIComponent(agent.ensFullName)}/interact`}
          className="inline-flex h-9 flex-1 min-w-[120px] items-center justify-center rounded-control bg-accent font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-void no-underline transition-colors hover:bg-[#F0FF70]"
        >
          Ask for advice
        </Link>
      </div>
    </article>
  );
}
