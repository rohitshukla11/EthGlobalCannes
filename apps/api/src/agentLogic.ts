import type { AgentRecord } from "./types.js";
import { downloadFrom0G, uploadJsonTo0G } from "./storage0g.js";
import { infer0GChat } from "./compute0g.js";

export type AgentConfig = {
  name: string;
  expertise: string;
  personality: string;
};

export async function loadAgentConfig(agent: AgentRecord): Promise<AgentConfig> {
  const raw = await downloadFrom0G(agent.configRoot);
  return JSON.parse(raw) as AgentConfig;
}

/** Naive RAG: pull text from latest memory / conversation roots (most recent first). */
export async function buildRagContext(agent: AgentRecord, maxChars = 6000): Promise<string> {
  const roots = [...agent.memoryRoots, ...agent.conversationRoots].slice(-12).reverse();
  const chunks: string[] = [];
  let n = 0;
  for (const r of roots) {
    if (n >= maxChars) break;
    try {
      const t = await downloadFrom0G(r);
      chunks.push(t.slice(0, 2000));
      n += t.length;
    } catch {
      /* skip missing */
    }
  }
  return chunks.join("\n---\n").slice(0, maxChars);
}

export async function runAgentTurn(
  target: AgentRecord,
  userMessage: string,
  caller?: AgentRecord | null
): Promise<string> {
  const cfg = await loadAgentConfig(target);
  const rag = await buildRagContext(target);
  const callerBlock = caller
    ? `You are replying to another agent: ${caller.name} (${caller.expertise}).`
    : "You are replying to a human operator.";
  const system = `You are a digital twin agent named "${cfg.name}".
Expertise: ${cfg.expertise}
Personality: ${cfg.personality}
${callerBlock}

Relevant memory and prior exchanges (retrieved from decentralized storage):
${rag || "(none yet)"}

Stay in character. Be concise and actionable.`;
  const messages = [
    { role: "system", content: system },
    { role: "user", content: userMessage },
  ];
  return infer0GChat(messages);
}

export async function persistMemorySnippet(agent: AgentRecord, snippet: object) {
  const root = await uploadJsonTo0G(snippet);
  return root;
}
