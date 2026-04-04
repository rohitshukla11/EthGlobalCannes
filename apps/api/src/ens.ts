import { createPublicClient, createWalletClient, http, type Hex, type Address } from "viem";
import { namehash, normalize } from "viem/ens";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";
import { downloadFrom0G } from "./storage0g.js";
import type { AgentRecord } from "./types.js";

const publicResolverAbi = [
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;

const TWINN_TEXT_KEYS = [
  "twinn.agentId",
  "twinn.tokenId",
  "twinn.config",
  "twinn.memoryHead",
  "twinn.owner",
  "twinn.chain",
  "twinn.createdAt",
  "twinn.version",
  "twinn.agentType",
  "twinn.runtime",
  "twinn.tools",
  "twinn.worldId",
  "description",
] as const;

/** ENSIP-65-style agent text records (alongside twinn.*; readers prefer agent.* then twinn.*). */
const AGENT_TEXT_KEYS = [
  "agent.config",
  "agent.memory",
  "agent.runtime",
  "agent.tools",
  "agent.owner",
  "agent.tokenId",
  "agent.chain",
  "agent.version",
  "agent.type",
] as const;

const ALL_RESOLVER_TEXT_KEYS = [...TWINN_TEXT_KEYS, ...AGENT_TEXT_KEYS] as const;

/** Prefer `agent.*` (ENSIP-style), fall back to legacy `twinn.*`. */
export function effectiveConfigRoot(texts: Record<string, string>): string | undefined {
  const v = texts["agent.config"]?.trim() || texts["twinn.config"]?.trim();
  return v || undefined;
}

export function effectiveMemoryHead(texts: Record<string, string>): string | undefined {
  const v = texts["agent.memory"]?.trim() || texts["twinn.memoryHead"]?.trim();
  return v || undefined;
}

export function effectiveTokenIdText(texts: Record<string, string>): string | undefined {
  const v = texts["agent.tokenId"]?.trim() || texts["twinn.tokenId"]?.trim();
  return v || undefined;
}

export function effectiveOwnerWallet(texts: Record<string, string>): string | undefined {
  const v = texts["agent.owner"]?.trim() || texts["twinn.owner"]?.trim();
  return v || undefined;
}

export function effectiveRuntime(texts: Record<string, string>): string | undefined {
  const v = texts["agent.runtime"]?.trim() || texts["twinn.runtime"]?.trim();
  return v || undefined;
}

export function effectiveToolsCsv(texts: Record<string, string>): string | undefined {
  const v = texts["agent.tools"]?.trim() || texts["twinn.tools"]?.trim();
  return v || undefined;
}

export function effectiveAgentType(texts: Record<string, string>): string | undefined {
  const v = texts["agent.type"]?.trim() || texts["twinn.agentType"]?.trim();
  return v || undefined;
}

export function effectiveVersionText(texts: Record<string, string>): string | undefined {
  const v = texts["agent.version"]?.trim() || texts["twinn.version"]?.trim();
  return v || undefined;
}

export function hasAgentNamespaceRecords(texts: Record<string, string>): boolean {
  return Object.keys(texts).some((k) => k.startsWith("agent."));
}

export async function resolveEnsAddress(name: string): Promise<Address | null> {
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  try {
    const addr = await client.getEnsAddress({ name: normalize(name) });
    return addr;
  } catch {
    return null;
  }
}

export async function getEnsAgentMeta(name: string): Promise<{ agentId?: string; tokenId?: string; configRoot?: string }> {
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  try {
    const n = normalize(name);
    const [agentId, tokenIdTwinn, tokenIdAgent, configTwinn, configAgent] = await Promise.all([
      client.getEnsText({ name: n, key: "twinn.agentId" }),
      client.getEnsText({ name: n, key: "twinn.tokenId" }),
      client.getEnsText({ name: n, key: "agent.tokenId" }),
      client.getEnsText({ name: n, key: "twinn.config" }),
      client.getEnsText({ name: n, key: "agent.config" }),
    ]);
    const tokenId = tokenIdAgent || tokenIdTwinn || undefined;
    const configRoot = configAgent || configTwinn || undefined;
    return {
      agentId: agentId || undefined,
      tokenId,
      configRoot,
    };
  } catch {
    return {};
  }
}

/** All protocol `twinn.*` + ENSIP-style `agent.*` text records on Sepolia for a name. */
export async function getEnsAgentTexts(name: string): Promise<Record<string, string>> {
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  const n = normalize(name);
  const out: Record<string, string> = {};
  for (const key of ALL_RESOLVER_TEXT_KEYS) {
    try {
      const v = await client.getEnsText({ name: n, key });
      if (v) out[key] = v;
    } catch {
      /* nonexistent */
    }
  }
  return out;
}

export type ResolvedAgentProfile = {
  ensFullName: string;
  texts: Record<string, string>;
  configJson: Record<string, unknown> | null;
  resolvedAddress: Address | null;
};

function personalityToString(p: unknown, fallback: string): string {
  if (typeof p === "string") return p;
  if (p && typeof p === "object") {
    const o = p as Record<string, unknown>;
    if (typeof o.summary === "string") return o.summary;
    return JSON.stringify(p);
  }
  return fallback;
}

/**
 * Primary ENS-based profile: `agent.config` + `agent.tokenId` (ENSIP-style) or `twinn.config` + `twinn.tokenId`,
 * or legacy `twinn.agentId` only.
 */
export async function resolveFullAgentProfile(fullName: string): Promise<ResolvedAgentProfile | null> {
  const ensFullName = fullName.toLowerCase();
  const texts = await getEnsAgentTexts(ensFullName);
  const cfg = effectiveConfigRoot(texts);
  const tok = effectiveTokenIdText(texts);
  const hasProtocol = Boolean(cfg && tok);
  const hasLegacy = Boolean(texts["twinn.agentId"]);
  if (!hasProtocol && !hasLegacy) return null;
  const resolvedAddress = await resolveEnsAddress(ensFullName);
  let configJson: Record<string, unknown> | null = null;
  const root = cfg;
  if (root) {
    try {
      const raw = await downloadFrom0G(root);
      configJson = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      configJson = null;
    }
  }
  return { ensFullName, texts, configJson, resolvedAddress };
}

export function resolvedProfileToAgentRecord(profile: ResolvedAgentProfile): AgentRecord | null {
  const tokenRaw = effectiveTokenIdText(profile.texts);
  const configRoot = effectiveConfigRoot(profile.texts);
  if (!tokenRaw || !configRoot) return null;
  const tokenId = Number(tokenRaw);
  if (!Number.isFinite(tokenId)) return null;
  const legacyId = profile.texts["twinn.agentId"];
  const id = legacyId || `ens:${profile.ensFullName}`;
  const owner = (effectiveOwnerWallet(profile.texts) || profile.resolvedAddress || "").toLowerCase();
  const cfg = profile.configJson;
  const name =
    typeof cfg?.name === "string" ? cfg.name : typeof cfg?.ensName === "string" ? cfg.ensName : profile.ensFullName;
  const expertise = typeof cfg?.expertise === "string" ? cfg.expertise : "";
  const profession = typeof cfg?.profession === "string" ? cfg.profession : undefined;
  const specialization = typeof cfg?.specialization === "string" ? cfg.specialization : undefined;
  const experience = typeof cfg?.experience === "string" ? cfg.experience : undefined;
  const advisorTone = typeof cfg?.advisorTone === "string" ? cfg.advisorTone : undefined;
  const personality = personalityToString(cfg?.personality, "");
  const pricing = cfg?.pricing as AgentRecord["pricing"] | undefined;
  const personalitySliders = cfg?.personalitySliders as AgentRecord["personalitySliders"] | undefined;
  const systemPrompt = typeof cfg?.systemPrompt === "string" ? cfg.systemPrompt : undefined;
  const meta = cfg?.metadata as { createdAt?: string; creator?: string } | undefined;
  const createdAt =
    meta?.createdAt ||
    profile.texts["twinn.createdAt"] ||
    new Date().toISOString();
  const ensVersion = effectiveVersionText(profile.texts);
  const jsonVersion = typeof cfg?.version === "number" ? cfg.version : undefined;
  const configVersion = ensVersion ? Number(ensVersion) : jsonVersion ?? 1;
  const mem = effectiveMemoryHead(profile.texts);
  return {
    id,
    tokenId,
    owner,
    ensFullName: profile.ensFullName,
    agentType: effectiveAgentType(profile.texts) || undefined,
    ensMemoryHead: mem || undefined,
    name,
    expertise,
    profession,
    specialization,
    experience,
    advisorTone,
    personality,
    systemPrompt,
    configRoot,
    memoryRoots: [],
    conversationRoots: [],
    reputation: { interactions: 0, successes: 0 },
    createdAt,
    pricing,
    personalitySliders,
    configVersion: Number.isFinite(configVersion) ? configVersion : 1,
    configHistory: [],
    longTermRoots: [],
    turnsSinceReflection: 0,
  };
}

async function setTexts(
  fullName: string,
  entries: readonly (readonly [string, string])[]
): Promise<boolean> {
  const pk = config.ensOperatorPrivateKey;
  if (!pk) return false;
  const account = privateKeyToAccount(pk as Hex);
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(config.sepoliaRpc),
  });
  const resolver = await client.getEnsResolver({ name: normalize(fullName) });
  if (!resolver) return false;
  const node = namehash(normalize(fullName)) as Hex;
  for (const [key, value] of entries) {
    const hash = await wallet.writeContract({
      address: resolver,
      abi: publicResolverAbi,
      functionName: "setText",
      args: [node, key, value],
    });
    await client.waitForTransactionReceipt({ hash });
  }
  return true;
}

export type WriteEnsTwinOpts = {
  tokenId: number;
  configRoot: string;
  ownerWallet: string;
  chainId: string;
  createdAt: string;
  version: number;
  /** Protocol surface, e.g. openclaw */
  agentType?: string;
  /** e.g. openclaw-v1 */
  runtime?: string;
  /** Comma-separated tool names for twinn.tools */
  toolsCsv?: string;
  /** Initial memory head (usually empty until first turn) */
  memoryHead?: string;
  worldIdLinked?: boolean;
  /** If set, also writes twinn.agentId for backward compatibility with older indexers. */
  legacyAgentId?: string;
};

/**
 * Writes twinn.* (legacy protocol keys) and agent.* (ENSIP-65-style) text records when ENS_OPERATOR_PRIVATE_KEY
 * controls the name's resolver on Sepolia. Does not remove or omit twinn.* keys.
 */
export async function tryWriteEnsTwinRecords(fullName: string, opts: WriteEnsTwinOpts): Promise<boolean> {
  const owner = opts.ownerWallet.toLowerCase();
  const versionStr = String(opts.version);
  const agentType = opts.agentType ?? "openclaw";
  const runtimeTwin = opts.runtime ?? "openclaw-v1";
  /** Short ENSIP-style runtime label (still matches openClaw checks via substring "openclaw"). */
  const runtimeAgent = "openclaw";
  const tools = opts.toolsCsv ?? "";

  const entries: [string, string][] = [
    ["twinn.tokenId", String(opts.tokenId)],
    ["twinn.config", opts.configRoot],
    ["twinn.owner", owner],
    ["twinn.chain", opts.chainId],
    ["twinn.createdAt", opts.createdAt],
    ["twinn.version", versionStr],
    ["twinn.agentType", agentType],
    ["twinn.runtime", runtimeTwin],
    ["twinn.tools", tools],
    ["description", `Counselr AI agent — token ${opts.tokenId}`],
    ["agent.config", opts.configRoot],
    ["agent.owner", owner],
    ["agent.runtime", runtimeAgent],
    ["agent.tools", tools],
    ["agent.tokenId", String(opts.tokenId)],
    ["agent.chain", opts.chainId],
    ["agent.version", versionStr],
    ["agent.type", agentType],
  ];
  if (opts.memoryHead?.trim()) {
    const m = opts.memoryHead.trim();
    entries.push(["twinn.memoryHead", m], ["agent.memory", m]);
  }
  if (opts.legacyAgentId) entries.push(["twinn.agentId", opts.legacyAgentId]);
  if (opts.worldIdLinked) entries.push(["twinn.worldId", "1"]);
  return setTexts(fullName, entries);
}

/** Update canonical OpenClaw memory pointer on ENS (twinn.memoryHead + agent.memory). */
export async function updateEnsMemoryHead(fullName: string, memoryRoot: string): Promise<boolean> {
  const v = memoryRoot.trim();
  if (!v) return false;
  return setTexts(fullName, [
    ["twinn.memoryHead", v],
    ["agent.memory", v],
  ]);
}

/** Partial ENS update after config rotation (reflection / admin). */
export async function tryPatchEnsTwinAgent(fullName: string, patch: { configRoot: string; version: number }): Promise<boolean> {
  const v = String(patch.version);
  return setTexts(fullName, [
    ["twinn.config", patch.configRoot],
    ["twinn.version", v],
    ["agent.config", patch.configRoot],
    ["agent.version", v],
  ]);
}

/** Publishes latest decentralized agent index root (manifest on 0G) on a well-known ENS name. */
export async function tryWriteEnsIndexManifest(indexRoot: string): Promise<boolean> {
  const name = config.ensIndexName?.trim();
  if (!name || !indexRoot) return false;
  return setTexts(name, [["twinn.manifest", indexRoot]]);
}

/** Best-effort: publish verifiable training manifest pointer on the agent's ENS name. */
export async function tryWriteCounselrTrainingRecords(
  fullName: string,
  opts: { trainingRoot: string; docCount: number }
): Promise<boolean> {
  const root = opts.trainingRoot.trim();
  if (!root) return false;
  const day = new Date().toISOString().split("T")[0]!;
  return setTexts(fullName, [
    ["counselr.trainingRoot", root],
    ["counselr.trainingDocs", String(opts.docCount)],
    ["counselr.trainingUpdated", day],
  ]);
}
