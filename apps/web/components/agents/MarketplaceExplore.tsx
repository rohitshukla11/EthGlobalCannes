"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import type { MarketplaceAgent } from "@/lib/agentTypes";
import { PROFESSION_OPTIONS } from "@/lib/advisorUi";
import { AgentGrid } from "./AgentGrid";
import { DemoAdvisorStrip } from "./DemoAdvisorStrip";

type SortKey = "usage" | "reputation" | "recent";
type FilterKey = "all" | "verified" | "openclaw";

export function MarketplaceExplore() {
  const [sort, setSort] = useState<SortKey>("recent");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [professionFilter, setProfessionFilter] = useState<string>("");
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
      if (q) {
        const blob = `${a.ensFullName} ${a.name} ${a.expertise} ${a.specialization ?? ""} ${a.profession ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      if (filter === "verified" && !a.verifiedHumanTwin) return false;
      if (filter === "openclaw" && !a.openClawAgent) return false;
      if (professionFilter) {
        const p = (a.profession ?? "").trim().toLowerCase();
        if (p !== professionFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [agents, search, filter, professionFilter]);

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
        <h1 className="font-display text-4xl font-extrabold leading-none text-primary">Explore Advisors</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] text-secondary">
          AI advisors powered by real professionals — consult on-chain identities with verifiable memory on 0G.
        </p>
      </header>

      <DemoAdvisorStrip />

      <div className="relative z-[1] mb-8 space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <label className="block max-w-md flex-1">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
              Search advisors
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ENS, profession, or topic…"
              className="h-10 w-full rounded-control border border-mid bg-black/50 px-3.5 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
              aria-label="Search advisors"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Profession</span>
              <select
                value={professionFilter}
                onChange={(e) => setProfessionFilter(e.target.value)}
                className="h-10 min-w-[160px] rounded-control border border-mid bg-black/50 px-3 font-mono text-[12px] text-primary focus:border-accent focus:outline-none"
                aria-label="Filter by profession"
              >
                <option value="">All professions</option>
                {PROFESSION_OPTIONS.filter((o) => o.value !== "Custom").map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.emoji} {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-10 rounded-control border border-mid bg-black/50 px-3 font-mono text-[12px] text-primary focus:border-accent focus:outline-none"
                aria-label="Sort advisors"
              >
                <option value="usage">Most consultations</option>
                <option value="recent">Recently added</option>
                <option value="reputation">Highest reputation</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chip("all", "All")}
          {chip("verified", "Verified humans")}
          {chip("openclaw", "OpenClaw advisors")}
        </div>
      </div>

      {error ? <p className="mb-6 font-mono text-[13px] text-error">{error}</p> : null}
      {loading ? (
        <p className="py-20 text-center font-mono text-[13px] text-tertiary">Loading advisors…</p>
      ) : (
        <AgentGrid agents={filtered} />
      )}
    </div>
  );
}
