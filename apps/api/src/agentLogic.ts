import type { AgentRecord } from "./types.js";
import { downloadFrom0G, uploadJsonTo0G } from "./storage0g.js";
import { generateResponseWithFallback } from "./compute/providers.js";
import { isOpenClawEnabled } from "./openclaw/config.js";
import type { OpenClawConfig } from "./openclaw/types.js";
import type { RagSource, RunAgentResult } from "./openclaw/types.js";
import { getTrainingRagForInference } from "./trainingData.js";

export type AgentConfigEnvelope = {
  agentId?: string;
  ensFullName: string;
  tokenId?: number;
  owner?: string;
  version?: number;
};

export type AgentConfig = {
  name: string;
  expertise: string;
  personality: string;
  profession?: string;
  specialization?: string;
  experience?: string;
  advisorTone?: string;
  systemPrompt?: string;
  pricing?: AgentRecord["pricing"];
  personalitySliders?: AgentRecord["personalitySliders"];
  configVersion?: number;
  version?: number;
  openClaw?: OpenClawConfig;
  _counselr?: AgentConfigEnvelope;
  /** Legacy 0G config envelopes (readers prefer `_counselr`, then `_alter`, then `_twinnet`). */
  _alter?: AgentConfigEnvelope;
  _twinnet?: AgentConfigEnvelope;
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

export async function loadAgentConfig(agent: AgentRecord): Promise<AgentConfig> {
  const raw = await downloadFrom0G(agent.configRoot);
  const cfg = JSON.parse(raw) as AgentConfig;
  const personality = personalityToString(cfg.personality, agent.personality || "");
  return { ...cfg, personality };
}

/** Naive RAG: memory roots + optional long-term summaries. */
export async function buildRagContext(agent: AgentRecord, maxChars = 6000): Promise<string> {
  const roots = [
    ...(agent.longTermRoots ?? []),
    ...agent.memoryRoots,
    ...agent.conversationRoots,
  ]
    .slice(-16)
    .reverse();
  const chunks: string[] = [];
  let n = 0;
  for (const r of roots) {
    if (n >= maxChars) break;
    try {
      const t = await downloadFrom0G(r);
      chunks.push(t.slice(0, 2000));
      n += t.length;
    } catch {
      /* skip */
    }
  }
  return chunks.join("\n---\n").slice(0, maxChars);
}

function sliderHints(cfg: AgentConfig): string {
  const s = cfg.personalitySliders;
  if (!s) return "";
  return `\nVoice controls (humor ${s.humor}, tone ${s.tone}, intelligence ${s.intelligence} on 0–100) — lean into these.`;
}

export async function runAgentTurnDetailed(
  target: AgentRecord,
  userMessage: string,
  caller?: AgentRecord | null
): Promise<{ reply: string; provider: string; ragSources?: RagSource[] }> {
  const cfg = await loadAgentConfig(target);
  const training = await getTrainingRagForInference(target.id, userMessage);
  const rag = await buildRagContext(target);
  const callerBlock = caller
    ? `You are replying to another agent: ${caller.name} (${caller.expertise}).`
    : "You are replying to a human operator.";
  const trainingBlock = training.context
    ? `[TRAINING KNOWLEDGE — cite these sources in your response when relevant]\n${training.context}\n`
    : "";
  const ragBlock = `Relevant memory and prior exchanges (retrieved from decentralized storage):
${rag || "(none yet)"}

Stay in character. Be concise and actionable.`;
  const system = cfg.systemPrompt?.trim()
    ? `${cfg.systemPrompt.trim()}

${callerBlock}

${trainingBlock}
${ragBlock}`
    : `You are a digital twin agent named "${cfg.name}".
Expertise: ${cfg.expertise}
Personality: ${cfg.personality}${sliderHints(cfg)}
${callerBlock}

${trainingBlock}
${ragBlock}`;
  const messages = [
    { role: "system", content: system },
    { role: "user", content: userMessage },
  ];
  const { text, provider } = await generateResponseWithFallback(messages);
  if (training.sources.length) {
    console.log(`[RAG] Injected ${training.sources.length} training docs for agent ${target.id}`);
  }
  return { reply: text, provider, ragSources: training.sources.length ? training.sources : undefined };
}

export async function runAgentTurn(
  target: AgentRecord,
  userMessage: string,
  caller?: AgentRecord | null
): Promise<string> {
  const { reply } = await runAgentTurnDetailed(target, userMessage, caller);
  return reply;
}

export async function persistMemorySnippet(agent: AgentRecord, snippet: object) {
  const root = await uploadJsonTo0G(snippet);
  return root;
}

export type UnifiedTurnResult =
  | ({ mode: "openclaw" } & RunAgentResult)
  | { mode: "legacy"; reply: string; provider: string; ragSources?: RagSource[] };

/** OpenClaw when enabled in config; otherwise legacy single-shot completion (still may use 0G per compute chain). */
export async function runUnifiedAgentTurn(
  target: AgentRecord,
  userMessage: string,
  caller: AgentRecord | null,
  opts?: { delegatePeer?: AgentRecord }
): Promise<UnifiedTurnResult> {
  const cfg = await loadAgentConfig(target);
  if (isOpenClawEnabled(cfg)) {
    const { runOpenClawTurn } = await import("./openclaw/agent.js");
    const r = await runOpenClawTurn(target, userMessage, caller, opts);
    return { mode: "openclaw", ...r };
  }
  const r = await runAgentTurnDetailed(target, userMessage, caller);
  return { mode: "legacy", reply: r.reply, provider: r.provider, ragSources: r.ragSources };
}
