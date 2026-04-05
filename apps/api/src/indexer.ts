import { config } from "./config.js";
import {
  resolveFullAgentProfile,
  resolvedProfileToAgentRecord,
  resolveEnsAddress,
  getEnsAgentTexts,
  effectiveTokenIdText,
  effectiveOwnerWallet,
  effectiveAgentType,
  effectiveMemoryHead,
} from "./ens.js";
import { downloadFrom0G } from "./storage0g.js";
import { loadManifest } from "./manifest0g.js";
import type { AgentRecord, AgentIndexEntry } from "./types.js";
import { getAgentByEns, getAgentById, listAgents } from "./db.js";
import { readIntelligentDataRoots } from "./inft.js";

function personalityToString(p: unknown, fallback: string): string {
  if (typeof p === "string") return p;
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    if (typeof o.summary === "string") return o.summary;
    return JSON.stringify(p);
  }
  return fallback;
}

/** Enrich agent with iNFT intelligent data hashes (memory / proofs) for RAG. */
export async function enrichAgentWithINFTMemory(agent: AgentRecord): Promise<AgentRecord> {
  if (!agent.tokenId) return agent;
  try {
    const rows = await readIntelligentDataRoots(agent.tokenId);
    if (!rows.length) return agent;
    const hashes = rows.map((r) => r.hash);
    const tail = hashes.slice(1);
    const merged = [...tail, ...(agent.conversationRoots ?? [])];
    const uniq = [...new Set(merged)];
    return { ...agent, conversationRoots: uniq };
  } catch {
    return agent;
  }
}

export async function resolveAgentByConfigRoot(root: string): Promise<AgentRecord | null> {
  try {
    const raw = await downloadFrom0G(root);
    const j = JSON.parse(raw) as Record<string, unknown>;
    const meta = (j._alter ?? j._counselr ?? j._twinnet) as
      | {
          agentId?: string;
          ensFullName?: string;
          tokenId?: number;
          owner?: string;
          version?: number;
        }
      | undefined;
    const ensFromJson =
      (typeof j.ensName === "string" ? j.ensName : null) ||
      meta?.ensFullName ||
      (typeof j.name === "string" && String(j.name).includes(".eth") ? String(j.name) : null);
    if (!ensFromJson) return null;
    const ensKey = ensFromJson.toLowerCase();
    let tokenId = Number(meta?.tokenId ?? 0);
    const texts = await getEnsAgentTexts(ensKey);
    const tidText = effectiveTokenIdText(texts);
    if (tidText) tokenId = Number(tidText) || tokenId;
    const owner = (meta?.owner || effectiveOwnerWallet(texts) || "").toLowerCase();
    const id = meta?.agentId || `ens:${ensKey}`;
    const personality = personalityToString(j.personality, "");
    const systemPrompt = typeof j.systemPrompt === "string" ? j.systemPrompt : undefined;
    const cfgMeta = j.metadata as { createdAt?: string } | undefined;
    const agentType =
      effectiveAgentType(texts) ||
      (typeof j.agentType === "string" ? j.agentType : undefined) ||
      (j.openClaw ? "openclaw" : undefined);
    const ensMemoryHead = effectiveMemoryHead(texts) || undefined;
    const base: AgentRecord = {
      id,
      tokenId,
      owner,
      ensFullName: ensKey,
      agentType,
      ensMemoryHead,
      name: String(j.name ?? ensKey),
      expertise: String(j.expertise ?? ""),
      profession: typeof j.profession === "string" ? j.profession : undefined,
      specialization: typeof j.specialization === "string" ? j.specialization : undefined,
      experience: typeof j.experience === "string" ? j.experience : undefined,
      advisorTone: typeof j.advisorTone === "string" ? j.advisorTone : undefined,
      personality,
      systemPrompt,
      configRoot: root,
      memoryRoots: [],
      conversationRoots: [],
      reputation: { interactions: 0, successes: 0 },
      createdAt: cfgMeta?.createdAt || new Date().toISOString(),
      pricing: j.pricing as AgentRecord["pricing"],
      personalitySliders: j.personalitySliders as AgentRecord["personalitySliders"],
      configVersion:
        typeof meta?.version === "number"
          ? meta.version
          : typeof j.version === "number"
            ? j.version
            : typeof j.configVersion === "number"
              ? j.configVersion
              : 1,
      configHistory: [],
      longTermRoots: [],
      turnsSinceReflection: 0,
    };
    return enrichAgentWithINFTMemory(base);
  } catch {
    return null;
  }
}

export async function resolveAgentByENS(fullName: string): Promise<AgentRecord | null> {
  const profile = await resolveFullAgentProfile(fullName.toLowerCase());
  if (!profile) return null;
  const rec = resolvedProfileToAgentRecord(profile);
  if (!rec) return null;
  return enrichAgentWithINFTMemory(rec);
}

/** Stateless resolution: ENS → text records → 0G config (same as resolveAgentByENS). */
export const resolveAgent = resolveAgentByENS;

export async function listChainAgentIndex(): Promise<AgentIndexEntry[]> {
  const { fetchAgentCreatedLogs } = await import("./inft.js");
  try {
    const logs = await fetchAgentCreatedLogs();
    return logs.map((ev) => ({
      id: `ens:${ev.ensName.toLowerCase()}`,
      ensFullName: ev.ensName.toLowerCase(),
      owner: ev.owner,
      tokenId: ev.tokenId,
      configRoot: ev.configRoot,
      updatedAt: new Date().toISOString(),
      source: "chain" as const,
    }));
  } catch {
    return [];
  }
}

/** Merge local DB + optional 0G manifest + on-chain mint index based on DISCOVERY_MODE. */
export async function listDiscoverableAgents(): Promise<AgentIndexEntry[]> {
  const local = listAgents().map(
    (a): AgentIndexEntry => ({
      id: a.id,
      ensFullName: a.ensFullName,
      owner: a.owner,
      tokenId: a.tokenId,
      configRoot: a.configRoot,
      updatedAt: a.createdAt,
      source: "local",
    })
  );

  let chain: AgentIndexEntry[] = [];
  try {
    chain = await listChainAgentIndex();
  } catch {
    chain = [];
  }

  if (config.discoveryMode === "local") {
    const byEns = new Map<string, AgentIndexEntry>();
    for (const e of chain) byEns.set(e.ensFullName.toLowerCase(), e);
    for (const e of local) {
      const k = e.ensFullName.toLowerCase();
      const prev = byEns.get(k);
      byEns.set(k, prev ? { ...prev, ...e, source: "local" } : e);
    }
    return [...byEns.values()];
  }

  let remote: AgentIndexEntry[] = [];
  const root =
    config.agentIndexRoot ||
    (await (async () => {
      const idx = config.ensIndexName?.trim();
      if (!idx) return "";
      const t = await getEnsAgentTexts(idx);
      return t["agent.manifest"] ?? t["twinn.manifest"] ?? "";
    })());

  if (root) {
    const m = await loadManifest(root);
    if (m) remote = m.entries.map((e) => ({ ...e, source: "manifest" as const }));
  }

  if (config.discoveryMode === "ens") {
    const byEns = new Map<string, AgentIndexEntry>();
    for (const e of remote) byEns.set(e.ensFullName.toLowerCase(), e);
    for (const e of chain) {
      const k = e.ensFullName.toLowerCase();
      if (!byEns.has(k)) byEns.set(k, e);
    }
    for (const e of local) {
      const k = e.ensFullName.toLowerCase();
      if (!byEns.has(k)) byEns.set(k, e);
    }
    return [...byEns.values()];
  }

  /* hybrid: merge manifest + local + chain */
  const byEns = new Map<string, AgentIndexEntry>();
  for (const e of remote) byEns.set(e.ensFullName.toLowerCase(), e);
  for (const e of chain) {
    const k = e.ensFullName.toLowerCase();
    if (!byEns.has(k)) byEns.set(k, e);
  }
  for (const e of local) {
    const k = e.ensFullName.toLowerCase();
    if (!byEns.has(k)) byEns.set(k, e);
  }
  return [...byEns.values()];
}

/** Prefer ENS + 0G + chain; then local registry. */
export async function getAgentResilientById(id: string): Promise<AgentRecord | null> {
  const local = getAgentById(id);
  if (local) return enrichAgentWithINFTMemory(local);

  if (id.startsWith("ens:")) {
    const fromEns = await resolveAgentByENS(id.slice(4));
    if (fromEns) return fromEns;
  }
  if (id.includes(".eth")) {
    const fromEns = await resolveAgentByENS(id.toLowerCase());
    if (fromEns) return fromEns;
  }

  if (config.discoveryMode !== "local") {
    const entries = await listDiscoverableAgents();
    const hit = entries.find((e) => e.id === id);
    if (hit) return resolveAgentByENS(hit.ensFullName);
  }
  return null;
}

export async function getAgentResilientByEns(name: string): Promise<AgentRecord | null> {
  const normalized = name.toLowerCase();
  const fromEns = await resolveAgentByENS(normalized);
  if (fromEns) return fromEns;
  const cached = getAgentByEns(normalized);
  if (cached) return enrichAgentWithINFTMemory(cached);
  return null;
}
