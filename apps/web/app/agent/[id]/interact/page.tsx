"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { AgentConsole } from "@/components/agents/AgentConsole";

function InteractInner() {
  const params = useParams();
  const raw = typeof params.id === "string" ? params.id : "";
  const id = useMemo(() => decodeURIComponent(raw), [raw]);

  const fromPath = useMemo(() => {
    if (id.startsWith("ens:")) return id.slice(4);
    if (id.includes(".eth")) return id;
    return "";
  }, [id]);

  const [resolvedEns, setResolvedEns] = useState(fromPath);

  useEffect(() => {
    setResolvedEns(fromPath);
  }, [fromPath]);

  useEffect(() => {
    if (fromPath) return;
    if (!id) return;
    let cancelled = false;
    apiGet<{ agent: { ensFullName: string } }>(`/agents/${encodeURIComponent(id)}`)
      .then((r) => {
        if (!cancelled) setResolvedEns(r.agent.ensFullName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, fromPath]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3 font-mono text-[12px]">
        <Link href="/marketplace" className="text-tertiary no-underline hover:text-secondary">
          ← Explore
        </Link>
        <span className="text-tertiary">/</span>
        <Link
          href={`/agent/${encodeURIComponent(id)}`}
          className="text-tertiary no-underline hover:text-secondary"
        >
          Profile
        </Link>
      </div>
      <header>
        <h1 className="font-display text-3xl font-extrabold leading-tight text-primary sm:text-4xl">
          Consultation
        </h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          Ask for advice — OpenClaw execution and advisor memory on 0G, verifiable each turn.
        </p>
      </header>
      <AgentConsole initialEns={resolvedEns} />
    </div>
  );
}

export default function AgentInteractPage() {
  return (
    <Suspense fallback={<p className="font-mono text-[13px] text-tertiary">Loading…</p>}>
      <InteractInner />
    </Suspense>
  );
}
