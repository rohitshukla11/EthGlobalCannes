import Link from "next/link";
import { apiGet } from "@/lib/api";

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
        <Link href="/marketplace" className="mt-6 inline-block font-mono text-[13px] text-secondary no-underline hover:text-primary">
          ← Marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[13px]">
        <Link href="/marketplace" className="text-tertiary no-underline hover:text-secondary">
          ← Marketplace
        </Link>
        <Link
          href={`/agent/${encodeURIComponent(agent.id)}/interact`}
          className="text-accent no-underline underline-offset-4 hover:text-[#F0FF70]"
        >
          Interact
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
        <h1 className="font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">{agent.ensFullName}</h1>
        <p className="mt-2 font-mono text-[15px] font-medium text-primary">{agent.name}</p>
        <p className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[13px] text-secondary">
          <span>
            Owner <span className="text-primary">{agent.owner}</span>
          </span>
          <span className="text-tertiary">·</span>
          <span className="border border-dim px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-secondary">
            iNFT #{agent.tokenId}
          </span>
          {agent.openClawAgent ? (
            <span className="rounded-full border border-[rgba(232,255,90,0.45)] bg-[rgba(232,255,90,0.1)] px-2 py-0.5 text-[9px] uppercase tracking-[0.1em] text-accent">
              OpenClaw
            </span>
          ) : null}
        </p>
        {agent.toolsEnabled?.length ? (
          <p className="mt-2 font-mono text-[11px] text-tertiary">
            Tools: <span className="text-secondary">{agent.toolsEnabled.join(", ")}</span>
          </p>
        ) : null}
      </header>
      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">Expertise</h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary">{agent.expertise}</p>
      </section>
      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">Personality</h2>
        <p className="font-mono text-[13px] leading-relaxed text-secondary">{agent.personality}</p>
      </section>
      <section className="rounded-ui border border-dim bg-raised p-7">
        <h2 className="type-eyebrow mb-3">On-chain &amp; storage</h2>
        <p className="font-mono text-[11px] text-tertiary">
          Memory evolves on 0G (OpenClaw DAG: each turn uploads a new root linked via{" "}
          <code className="text-secondary">previousMemoryRoot</code>).
        </p>
        <p className="mt-3 break-all font-mono text-[11px] text-tertiary">Config root (0G): {agent.configRoot}</p>
        <p className="mt-4 font-mono text-[13px] text-secondary">
          Reputation: {agent.reputation.interactions} interactions, {agent.reputation.successes} successful inference runs.
        </p>
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
