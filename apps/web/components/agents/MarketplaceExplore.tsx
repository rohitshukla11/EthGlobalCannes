"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import type { MarketplaceAgent } from "@/lib/agentTypes";
import { AgentGrid } from "./AgentGrid";

type SortKey = "usage" | "reputation" | "recent";
type FilterKey = "all" | "verified" | "openclaw";

export function MarketplaceExplore() {
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [agents, setAgents] = useState<MarketplaceAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = `?sort=${encodeURIComponent(sort)}`;
      const data = await apiGet<{ agents: MarketplaceAgent[] }>(`/agents${q}`);
      setAgents(data.agents);
    } catch (e) {
      setError(String(e));
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [sort]);

  useEffect(() => {
    fetchAgents().catch(() => {});
  }, [fetchAgents]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (q && !a.ensFullName.toLowerCase().includes(q) && !a.name.toLowerCase().includes(q)) {
        return false;
      }
      if (filter === "verified" && !a.verifiedHumanTwin) return false;
      if (filter === "openclaw" && !a.openClawAgent) return false;
      return true;
    });
  }, [agents, search, filter]);

  const chip = (key: FilterKey, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(key)}
      className={
        filter === key
          ? "rounded-full border border-accent bg-[rgba(232,255,90,0.1)] px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-accent"
          : "rounded-full border border-dim px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-secondary transition-colors hover:border-mid"
      }
    >
      {label}
    </button>
  );

  return (
    <div className="relative">
      <div
        className="pointer-events-none fixed inset-0 -z-10 opacity-[0.06]"
        aria-hidden
        style={{
          backgroundImage: `linear-gradient(rgba(232,255,90,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(232,255,90,0.4) 1px, transparent 1px)`,
          backgroundSize: "56px 56px",
        }}
      />

      <header className="relative z-[1] mb-10">
        <h1 className="font-display text-4xl font-extrabold leading-none text-primary">Explore Agents</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          Human-verified AI twins running on 0G
        </p>
      </header>

      <div className="relative z-[1] mb-8 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="block max-w-md flex-1">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
              Search by ENS
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="aria.eth"
              className="h-10 w-full rounded-control border border-mid bg-black/50 px-3.5 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
              aria-label="Search agents by ENS"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 rounded-control border border-mid bg-black/50 px-3 font-mono text-[12px] text-primary focus:border-accent focus:outline-none"
              aria-label="Sort agents"
            >
              <option value="usage">Most used</option>
              <option value="recent">Recently created</option>
              <option value="reputation">Highest reputation</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chip("all", "All")}
          {chip("verified", "Verified humans")}
          {chip("openclaw", "OpenClaw agents")}
        </div>
      </div>

      {error ? <p className="mb-6 font-mono text-[13px] text-error">{error}</p> : null}
      {loading ? (
        <p className="py-20 text-center font-mono text-[13px] text-tertiary">Loading agents…</p>
      ) : (
        <AgentGrid agents={filtered} />
      )}
    </div>
  );
}
