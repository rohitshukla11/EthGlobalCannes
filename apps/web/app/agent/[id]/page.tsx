import Link from "next/link";
import { apiGet } from "@/lib/api";
import {
  formatConsultationPrice,
  formatProfessionLabel,
  isWeb3ArchitectProfession,
  professionEmoji,
} from "@/lib/advisorUi";
import type { AgentPricing } from "@/lib/agentTypes";

export const dynamic = "force-dynamic";

type Agent = {
  id: string;
  ensFullName: string;
  name: string;
  expertise: string;
  personality: string;
  owner: string;
  tokenId: number;
  configRoot: string;
  reputation: { interactions: number; successes: number };
  createdAt: string;
  type: string;
  openClawAgent?: boolean;
  toolsEnabled?: string[];
  agentType?: string | null;
  profession?: string | null;
  specialization?: string | null;
  experience?: string | null;
  advisorTone?: string | null;
  pricing?: AgentPricing | null;
  trainingRoot?: string | null;
  trainingDocCount?: number;
  trainingUpdatedAt?: number | null;
};

export default async function AgentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  let agent: Agent | null = null;
  let history: { memoryRoots: string[]; conversationRoots: string[] } | null = null;
  let error: string | null = null;
  try {
    const enc = encodeURIComponent(id);
    const a = await apiGet<{ agent: Agent }>(`/agents/${enc}`);
    agent = a.agent;
    history = await apiGet<{ memoryRoots: string[]; conversationRoots: string[] }>(`/agents/${enc}/history`);
  } catch (e) {
    error = String(e);
  }

  if (error || !agent) {
    return (
      <div className="rounded-ui border border-error/40 bg-raised p-8">
        <p className="font-mono text-[13px] text-error">{error ?? "Not found"}</p>
        <Link
          href="/marketplace"
          className="mt-6 inline-block font-mono text-[13px] text-secondary no-underline hover:text-primary"
        >
          ← Explore Advisors
        </Link>
      </div>
    );
  }

  const profession = agent.profession?.trim() || "Advisor";
  const professionLabel = formatProfessionLabel(agent.profession);
  const emoji = professionEmoji(profession);
  const specialization = agent.specialization?.trim() || "Professional advisory";

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[13px]">
        <Link href="/marketplace" className="text-tertiary no-underline hover:text-secondary">
          ← Explore Advisors
        </Link>
        <Link
          href={`/agent/${encodeURIComponent(agent.ensFullName)}/interact`}
          className="text-accent no-underline underline-offset-4 hover:text-[#F0FF70]"
        >
          Ask for advice
        </Link>
        <span className="text-tertiary">·</span>
        <Link
          href={`/agent/${encodeURIComponent(agent.id)}/training`}
          className="text-accent no-underline underline-offset-4 hover:text-[#F0FF70]"
        >
          Training data{(agent.trainingDocCount ?? 0) > 0 ? ` (${agent.trainingDocCount})` : ""}
        </Link>
        <span className="text-tertiary">·</span>
        <Link
          href={`/agent/${encodeURIComponent(agent.id)}/deployment`}
          className="text-accent no-underline underline-offset-4 hover:text-[#F0FF70]"
        >
          Deployment &amp; proofs →
        </Link>
      </div>

      <header>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-accent">
          <span className="mr-1.5" aria-hidden>
            {emoji}
          </span>
          {professionLabel}
        </p>
        <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">
          {specialization}
        </h1>
        <p className="mt-2 font-mono text-[14px] text-secondary">{agent.name}</p>
        <p className="mt-1 font-mono text-[13px] text-tertiary">{agent.ensFullName}</p>
        {isWeb3ArchitectProfession(agent.profession) ? (
          <p className="mt-3 max-w-subtitle font-mono text-[12px] leading-relaxed text-secondary">
            This AI represents your Web3 expertise and helps design token launches.
          </p>
        ) : null}
        <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[13px] text-secondary">
          <span>
            Owner <span className="text-primary">{agent.owner}</span>
          </span>
          <span className="text-tertiary">·</span>
          <span className="border border-dim px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-secondary">
            iNFT #{agent.tokenId}
          </span>
        </p>
        <p className="mt-4 font-mono text-[13px] text-secondary">
          <span className="text-tertiary">Consultation: </span>
          {formatConsultationPrice(agent.pricing ?? null)}
        </p>
        {agent.toolsEnabled?.length ? (
          <p className="mt-2 font-mono text-[11px] text-tertiary">
            Tools: <span className="text-secondary">{agent.toolsEnabled.join(", ")}</span>
          </p>
        ) : null}
      </header>

      {agent.experience?.trim() ? (
        <section className="rounded-ui border border-dim bg-raised p-7">
          <h2 className="type-eyebrow mb-3">Experience &amp; credibility</h2>
          <p className="font-mono text-[13px] leading-relaxed text-secondary">{agent.experience}</p>
        </section>
      ) : null}

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">How they help</h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary">&ldquo;{agent.expertise}&rdquo;</p>
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">Expertise areas</h2>
        <ul className="list-inside list-disc font-mono text-[13px] leading-relaxed text-secondary">
          <li>{specialization}</li>
          {agent.advisorTone ? (
            <li>
              Tone: <span className="text-primary">{agent.advisorTone}</span>
            </li>
          ) : null}
          <li>OpenClaw reasoning with tools (ENS, memory, optional web)</li>
        </ul>
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">Example consultations</h2>
        <p className="mb-3 font-mono text-[12px] text-tertiary">
          Suggested prompts — the advisor responds with structured, professional guidance.
        </p>
        <ul className="space-y-2 font-mono text-[12px] leading-relaxed text-secondary">
          <li>&ldquo;What should I prioritize in the next 30 days for compliance?&rdquo;</li>
          <li>&ldquo;Walk me through risks and mitigations for my situation.&rdquo;</li>
          <li>&ldquo;Summarize options with tradeoffs — no hype.&rdquo;</li>
        </ul>
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">Style</h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary">{agent.personality}</p>
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">ENS, iNFT &amp; memory</h2>
        <p className="font-mono text-[11px] text-tertiary">
          Identity resolves on Sepolia; config and conversation memory live on 0G. OpenClaw links each turn to the previous
          memory root for an auditable chain of consultations.
        </p>
        <p className="mt-3 break-all font-mono text-[11px] text-tertiary">Config root (0G): {agent.configRoot}</p>
        <p className="mt-4 font-mono text-[13px] text-secondary">
          Reputation: {agent.reputation.interactions} consultations started, {agent.reputation.successes} completed
          successfully.
        </p>
        {(agent.trainingDocCount ?? 0) > 0 ? (
          <p className="mt-3 font-mono text-[11px] text-tertiary">
            Training corpus:{" "}
            <Link href={`/agent/${encodeURIComponent(agent.id)}/training`} className="text-accent no-underline hover:underline">
              {agent.trainingDocCount} documents on 0G
            </Link>
            {agent.trainingRoot ? (
              <>
                {" "}
                · manifest <span className="text-secondary">{String(agent.trainingRoot).slice(0, 10)}…</span>
              </>
            ) : null}
          </p>
        ) : null}
      </section>

      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">Memory roots</h2>
        <ul className="mt-2 space-y-1 font-mono text-[11px] text-tertiary">
          {(history?.memoryRoots ?? []).map((r) => (
            <li key={r} className="break-all">
              {r}
            </li>
          ))}
          {!history?.memoryRoots?.length ? <li className="text-tertiary/60">—</li> : null}
        </ul>
        <h3 className="type-eyebrow mb-2 mt-6">Conversation roots</h3>
        <ul className="mt-2 space-y-1 font-mono text-[11px] text-tertiary">
          {(history?.conversationRoots ?? []).map((r) => (
            <li key={r} className="break-all">
              {r}
            </li>
          ))}
          {!history?.conversationRoots?.length ? <li className="text-tertiary/60">—</li> : null}
        </ul>
      </section>
    </div>
  );
}
