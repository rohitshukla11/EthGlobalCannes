import type { AgentRecord, ConfigVersionEntry } from "./types.js";
import { uploadJsonTo0G, downloadFrom0G } from "./storage0g.js";
import { config } from "./config.js";
import { infer0GChat } from "./compute0g.js";
import { updateAgent, getAgentById } from "./db.js";
import { updateAgentConfigOnChain } from "./inft.js";
import { tryPatchEnsTwinAgent } from "./ens.js";
import type { RunAgentResult } from "./openclaw/types.js";

const SHORT_TERM_N = 24;

const MEMORY_CLAW = "counselr-memory-openclaw/v1" as const;
const MEMORY_CLAW_LEGACY_ALTER = "alter-memory-openclaw/v1" as const;
const MEMORY_CLAW_LEGACY = "twinnet-memory-openclaw/v1" as const;
const MEMORY_SHORT = "counselr-memory-short/v1" as const;
const MEMORY_LONG = "counselr-memory-long/v1" as const;

function isClawMemoryType(
  t: unknown
): t is typeof MEMORY_CLAW | typeof MEMORY_CLAW_LEGACY_ALTER | typeof MEMORY_CLAW_LEGACY {
  return t === MEMORY_CLAW || t === MEMORY_CLAW_LEGACY_ALTER || t === MEMORY_CLAW_LEGACY;
}

/** OpenClaw persistent memory head (DAG: each upload points at previous root). */
export type ClawMemoryDoc = {
  type: typeof MEMORY_CLAW | typeof MEMORY_CLAW_LEGACY_ALTER | typeof MEMORY_CLAW_LEGACY;
  agentId: string;
  ens: string;
  previousMemoryRoot: string | null;
  at: string;
  messages: { role: string; content: string }[];
  toolsUsed: { name: string; arguments: Record<string, unknown>; result: string }[];
  reflections: string[];
};

export async function loadLatestClawMemory(agent: AgentRecord): Promise<{
  doc: ClawMemoryDoc;
  /** Root hash of the latest OpenClaw memory blob if any */
  headRoot: string | null;
}> {
  const empty: ClawMemoryDoc = {
    type: MEMORY_CLAW,
    agentId: agent.id,
    ens: agent.ensFullName,
    previousMemoryRoot: null,
    at: new Date().toISOString(),
    messages: [],
    toolsUsed: [],
    reflections: [],
  };
  const ensHead = agent.ensMemoryHead?.trim();
  if (ensHead) {
    try {
      const raw = await downloadFrom0G(ensHead);
      const j = JSON.parse(raw) as ClawMemoryDoc;
      if (isClawMemoryType(j.type)) {
        return { doc: j, headRoot: ensHead };
      }
    } catch {
      /* stale pointer or non-Claw blob */
    }
  }
  for (let i = agent.conversationRoots.length - 1; i >= 0; i--) {
    const root = agent.conversationRoots[i]!;
    try {
      const raw = await downloadFrom0G(root);
      const j = JSON.parse(raw) as ClawMemoryDoc;
      if (isClawMemoryType(j.type)) {
        return { doc: j, headRoot: root };
      }
    } catch {
      /* legacy per-turn snippets */
    }
  }
  return { doc: empty, headRoot: null };
}

export function mergeClawMemoryForTurn(
  agent: AgentRecord,
  prior: ClawMemoryDoc,
  headRoot: string | null,
  run: RunAgentResult
): ClawMemoryDoc {
  return {
    type: MEMORY_CLAW,
    agentId: agent.id,
    ens: agent.ensFullName,
    previousMemoryRoot: headRoot,
    at: new Date().toISOString(),
    messages: run.workingMemory.messages.slice(-80),
    toolsUsed: [...prior.toolsUsed, ...run.toolsUsed].slice(-200),
    reflections: run.workingMemory.reflections.slice(-100),
  };
}

export type MemorySnippet = {
  ts: string;
  role: "user" | "assistant" | "system";
  summary?: string;
  content?: string;
};

export async function persistShortTermWindow(agent: AgentRecord, windows: MemorySnippet[]): Promise<string> {
  const payload = {
    type: MEMORY_SHORT,
    agentId: agent.id,
    ens: agent.ensFullName,
    window: windows.slice(-SHORT_TERM_N),
    at: new Date().toISOString(),
  };
  return uploadJsonTo0G(payload);
}

export async function persistLongTermTrait(agent: AgentRecord, traitSummary: string): Promise<string> {
  const payload = {
    type: MEMORY_LONG,
    agentId: agent.id,
    summary: traitSummary,
    at: new Date().toISOString(),
  };
  return uploadJsonTo0G(payload);
}

/** Periodic reflection: new 0G config root + version bump when REFLECTION_EVERY_N hits. */
export async function maybeRunReflection(agentId: string): Promise<boolean> {
  const n = config.reflectionEveryN;
  if (!n || n <= 0) return false;
  const agent = getAgentById(agentId);
  if (!agent) return false;
  const turns = agent.turnsSinceReflection ?? 0;
  if (turns < n) return false;

  const recentRoots = agent.conversationRoots.slice(-Math.min(turns, 48));
  const snippets: string[] = [];
  for (const r of recentRoots) {
    try {
      const t = await downloadFrom0G(r);
      snippets.push(t.slice(0, 1500));
    } catch {
      /* skip */
    }
  }
  if (!snippets.length) return false;

  const bullet = snippets.join("\n---\n").slice(0, 12000);
  const messages = [
    {
      role: "system",
      content:
        "You evolve a digital twin's personality line in one short paragraph (max 600 chars). Output ONLY the new personality text, no labels.",
    },
    {
      role: "user",
      content: `Current personality:\n${agent.personality}\n\nRecent exchanges:\n${bullet}`,
    },
  ];
  const text = await infer0GChat(messages);
  const mergedPersonality = text.trim().slice(0, 2000);

  const nextVersion = (agent.configVersion ?? 1) + 1;
  const history: ConfigVersionEntry[] = [
    ...(agent.configHistory ?? []),
    { version: agent.configVersion ?? 1, configRoot: agent.configRoot, at: new Date().toISOString() },
  ].slice(-24);

  const createdAt = agent.createdAt || new Date().toISOString();
  const body = {
    version: nextVersion,
    name: agent.name,
    ensName: agent.ensFullName,
    profession: agent.profession,
    specialization: agent.specialization,
    experience: agent.experience,
    advisorTone: agent.advisorTone,
    expertise: agent.expertise,
    personality: mergedPersonality,
    personalitySliders: agent.personalitySliders,
    pricing: agent.pricing,
    configVersion: nextVersion,
    metadata: {
      createdAt,
      creator: agent.owner,
    },
    _alter: {
      ensFullName: agent.ensFullName,
      tokenId: agent.tokenId,
      owner: agent.owner,
      version: nextVersion,
    },
  };
  const newRoot = await uploadJsonTo0G(body);

  const longRoot = await persistLongTermTrait(agent, mergedPersonality);
  const longTerm = [...(agent.longTermRoots ?? []), longRoot].slice(-16);

  try {
    await updateAgentConfigOnChain(agent.tokenId, newRoot, "");
  } catch {
    /* optional if contract not upgraded or keys missing */
  }
  try {
    await tryPatchEnsTwinAgent(agent.ensFullName, { configRoot: newRoot, version: nextVersion });
  } catch {
    /* optional */
  }

  updateAgent(agentId, {
    personality: mergedPersonality,
    configRoot: newRoot,
    configVersion: nextVersion,
    configHistory: history,
    longTermRoots: longTerm,
    turnsSinceReflection: 0,
  });
  return true;
}

export function bumpReflectionCounter(agentId: string): void {
  const agent = getAgentById(agentId);
  if (!agent) return;
  updateAgent(agentId, {
    turnsSinceReflection: (agent.turnsSinceReflection ?? 0) + 1,
  });
}
