import type { AgentRecord } from "../types.js";
import type { AgentConfig } from "../agentLogic.js";
import { loadAgentConfig } from "../agentLogic.js";
import { runAgentLoop } from "./runtime.js";
import { formatProfessionalResponse } from "./responseFormatter.js";
import { summarizeStep } from "./summarizeStep.js";
import { isOpenClawEnabled } from "./config.js";
import type { OpenClawConfig, RunAgentResult, ToolContext } from "./types.js";
import { getTrainingRagForInference } from "../trainingData.js";
import type { ClawMemoryDoc } from "../memoryEngine.js";
import { loadLatestClawMemory, mergeClawMemoryForTurn } from "../memoryEngine.js";
import { resolveAgentByENS } from "../indexer.js";

const ALL_TOOLS = `Available tools (JSON arguments):
- getMemory {} — snapshot of rolling conversation memory for this agent.
- saveMemory {"note":"string"} — append operator-visible reflection.
- fetchENSProfile {"name":"name.eth"} — Sepolia resolver text records (twinn.* / agent.*). Not Ethereum mainnet: famous names may return empty.
- fetchAgentConfig {"name":"name.eth"} — ENS + 0G config summary for an agent.
- mockWebSearch {"query":"string"} — hackathon mock SERP (use for generic “get some data” / research steps).
- readEthBalance {"address":"0x..."} — Sepolia ETH balance (read-only).`;

const DELEGATE_TOOL = `
- invokePeerAgent {"targetEns":"name.eth","message":"string"} — run peer agent via OpenClaw (delegate flow only).`;

function sliderHints(cfg: AgentConfig): string {
  const s = cfg.personalitySliders;
  if (!s) return "";
  return `\nVoice: humor ${s.humor}, tone ${s.tone}, intelligence ${s.intelligence} (0–100).`;
}

function pickToolsList(oc: OpenClawConfig | undefined, withDelegate: boolean): string {
  const allowed = oc?.tools?.length ? new Set(oc.tools) : null;
  let block = ALL_TOOLS;
  if (withDelegate) {
    block += DELEGATE_TOOL;
  }
  if (allowed) {
    block += `\n\nConfigured allow-list: ${[...allowed].join(", ")}`;
    if (withDelegate) {
      block += "\n(delegate flow: you may also call invokePeerAgent even if not listed.)";
    }
  }
  return block;
}

export async function runOpenClawTurn(
  target: AgentRecord,
  userMessage: string,
  caller: AgentRecord | null,
  opts?: { delegatePeer?: AgentRecord }
): Promise<RunAgentResult> {
  const cfg = await loadAgentConfig(target);
  if (!isOpenClawEnabled(cfg)) {
    throw new Error("OpenClaw disabled for this agent (openClaw.enabled=false)");
  }

  const oc = (cfg.openClaw ?? {}) as OpenClawConfig;
  const maxSteps = oc.maxSteps ?? 8;

  const { doc: priorDoc, headRoot } = await loadLatestClawMemory(target);
  const working: ToolContext["workingMemory"] = {
    messages: [...priorDoc.messages],
    toolsUsed: [...priorDoc.toolsUsed],
    reflections: [...priorDoc.reflections],
  };

  const toolCtx: ToolContext = {
    subject: target,
    caller,
    workingMemory: working,
    previousMemoryRoot: headRoot,
    delegatePeer: opts?.delegatePeer,
  };

  const callerBlock = caller
    ? `You may receive messages on behalf of another agent: ${caller.name} (${caller.ensFullName}).`
    : "You are speaking with a human operator.";

  const rag = await getTrainingRagForInference(target.id, userMessage);
  const trainingInject = rag.context
    ? `\n\n[TRAINING KNOWLEDGE — cite these sources in your response when relevant]\n${rag.context}`
    : "";
  if (rag.sources.length) {
    console.log(`[RAG] Injected ${rag.sources.length} training docs for agent ${target.id} (OpenClaw)`);
  }

  const baseSystem =
    (cfg.systemPrompt?.trim() ||
      `You are "${cfg.name}", a professional advisor on Counselr (OpenClaw on 0G).
Expertise: ${cfg.expertise}
Personality: ${cfg.personality}${sliderHints(cfg)}
${callerBlock}

Turn discipline: earlier messages are background only. Each new user message is a fresh instruction—answer that message directly. Do not repeat prior tool calls (e.g. the same ENS lookup) unless the current message explicitly asks for them again. For open-ended “use tools / get data” tasks with no ENS name given, prefer mockWebSearch or getMemory—not a guess from old context.

Use tools when you need live ENS/config data or to persist a reflection. Be concise.

In FINAL replies: give specific, structured guidance (bullet-style mentally). Avoid generic openers like "you should consider several" without naming concrete factors next.`) + trainingInject;

  const toolsPrompt = pickToolsList(oc, Boolean(opts?.delegatePeer));

  const invokePeer = opts?.delegatePeer
    ? async (targetEns: string, message: string) => {
        const peer = await resolveAgentByENS(targetEns.toLowerCase());
        if (!peer) return `error: peer not found: ${targetEns}`;
        if (peer.ensFullName === target.ensFullName) return "error: cannot delegate to self";
        const r = await runOpenClawTurn(peer, message, target);
        return r.reply;
      }
    : undefined;

  const out = await runAgentLoop(
    {
      systemPrompt: baseSystem,
      userInput: userMessage,
      memoryMessages: working.messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
      toolsPrompt,
      maxSteps,
    },
    toolCtx,
    invokePeer
  );

  const profession = target.profession?.trim() || cfg.profession?.trim();
  const reply = formatProfessionalResponse({ reply: out.reply, profession: profession || undefined });

  const wm = out.workingMemory;
  const last = wm.messages[wm.messages.length - 1];
  if (last?.role === "assistant") {
    last.content = reply;
  }

  const prefixSteps = rag.sources.map((s, i) => ({
    kind: "reasoning" as const,
    step: i,
    detail: `Fetching training doc: ${s.filename} · ${s.hash.slice(0, 10)}…`,
    shortSummary: `Fetching training doc · ${s.filename}`,
  }));
  const offset = prefixSteps.length;
  const merged = [...prefixSteps, ...out.steps.map((s) => ({ ...s, step: offset + s.step }))];

  const steps = merged.map((s, i, arr) => {
    if (s.kind !== "final") return s;
    const isLastFinal = !arr.slice(i + 1).some((x) => x.kind === "final");
    if (!isLastFinal) return s;
    const next = { ...s, detail: reply.slice(0, 2000) };
    return { ...next, shortSummary: summarizeStep(next) };
  });

  return {
    ...out,
    reply,
    steps,
    workingMemory: wm,
    ragSources: rag.sources.length ? rag.sources : undefined,
  };
}

export function buildClawMemoryAfterTurn(
  target: AgentRecord,
  priorDoc: ClawMemoryDoc,
  headRoot: string | null,
  run: RunAgentResult
): ClawMemoryDoc {
  return mergeClawMemoryForTurn(target, priorDoc, headRoot, run);
}
