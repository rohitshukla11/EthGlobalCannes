"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet } from "@/lib/api";
import type { MarketplaceAgent } from "@/lib/agentTypes";
import { PROFESSION_OPTIONS } from "@/lib/advisorUi";
import { AgentGrid } from "./AgentGrid";
import { DemoAdvisorStrip } from "./DemoAdvisorStrip";
import { CustomSelect, type SelectOption } from "@/components/ui/CustomSelect";

type SortKey = "usage" | "reputation" | "recent";

export function MarketplaceExplore() {
  const [sort, setSort] = useState<SortKey>("recent");
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
      if (professionFilter) {
        const p = (a.profession ?? "").trim().toLowerCase();
        if (p !== professionFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [agents, search, professionFilter]);

  const stats = useMemo(() => {
    const professions = new Set(agents.map((a) => (a.profession ?? "").trim()).filter(Boolean));
    const consultations = agents.reduce((acc, a) => acc + (a.reputation?.interactions ?? 0), 0);
    return { advisors: agents.length, professions: professions.size, consultations };
  }, [agents]);

  const sortOptions: SelectOption<SortKey>[] = [
    { value: "recent", label: "Recently added" },
    { value: "usage", label: "Most consultations" },
    { value: "reputation", label: "Highest reputation" },
  ];

  const professionOptions: SelectOption<string>[] = [
    { value: "", label: "All professions" },
    ...PROFESSION_OPTIONS.filter((o) => o.value !== "Custom").map((o) => ({
      value: o.value,
      label: o.label,
    })),
  ];

  return (
    <div>
      <header className="mb-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-[var(--text-2)]">
            EXPLORE
          </p>
          <h1 className="mt-2 font-display text-5xl font-extrabold leading-none tracking-tight text-[var(--text-0)]">
            Find your advisor
          </h1>
        </div>
        <div className="flex shrink-0 items-stretch gap-0">
          <div className="flex flex-col px-6 first:pl-0">
            <span className="font-display text-xl font-bold text-[var(--text-0)]">{stats.advisors}</span>
            <span className="mt-1 font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--text-2)]">
              advisors
            </span>
          </div>
          <div className="w-px bg-[var(--border-1)]" aria-hidden />
          <div className="flex flex-col px-6">
            <span className="font-display text-xl font-bold text-[var(--text-0)]">{stats.professions}</span>
            <span className="mt-1 font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--text-2)]">
              professions
            </span>
          </div>
          <div className="w-px bg-[var(--border-1)]" aria-hidden />
          <div className="flex flex-col px-6 last:pr-0">
            <span className="font-display text-xl font-bold text-[var(--text-0)]">{stats.consultations}</span>
            <span className="mt-1 font-mono text-[10px] font-normal uppercase tracking-[0.08em] text-[var(--text-2)]">
              consultations
            </span>
          </div>
        </div>
      </header>

      <DemoAdvisorStrip />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-1 basis-[200px]">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-2)]" aria-hidden>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-4-4" strokeLinecap="round" />
            </svg>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, profession, specialty..."
            className="h-10 w-full rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] py-0 pl-[38px] pr-3.5 font-mono text-[13px] font-normal text-[var(--text-1)] placeholder:text-[var(--text-3)] focus:border-[var(--border-3)] focus:outline-none"
            aria-label="Search advisors"
          />
        </div>
        <CustomSelect
          value={professionFilter}
          onChange={(v) => setProfessionFilter(v)}
          options={professionOptions}
          aria-label="Filter by profession"
          widthClass="w-[180px]"
        />
        <CustomSelect
          value={sort}
          onChange={(v) => setSort(v as SortKey)}
          options={sortOptions}
          aria-label="Sort advisors"
          widthClass="w-[160px]"
        />
      </div>

      {error ? <p className="mb-6 font-mono text-[13px] text-[var(--error)]">{error}</p> : null}
      {loading ? (
        <p className="py-20 text-center font-mono text-[13px] text-[var(--text-2)]">Loading advisors…</p>
      ) : (
        <AgentGrid
          agents={filtered}
          onClearFilters={() => {
            setSearch("");
            setProfessionFilter("");
          }}
        />
      )}
    </div>
  );
}
