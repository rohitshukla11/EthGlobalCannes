import type { AgentRecord } from "../types.js";

export type OpenClawToolName =
  | "getMemory"
  | "saveMemory"
  | "fetchENSProfile"
  | "fetchAgentConfig"
  | "mockWebSearch"
  | "readEthBalance"
  | "invokePeerAgent";

export type ToolCallPayload = {
  name: OpenClawToolName | string;
  arguments: Record<string, unknown>;
};

export type RagSource = { filename: string; hash: string };

export type ExecutionStep = {
  kind: "reasoning" | "tool_call" | "tool_result" | "final";
  step: number;
  detail: string;
  tool?: string;
  durationMs?: number;
  /** One-line human-readable summary for demos */
  shortSummary?: string;
};

export type OpenClawConfig = {
  version?: number;
  enabled?: boolean;
  tools?: string[];
  maxSteps?: number;
};

export type ToolContext = {
  subject: AgentRecord;
  caller: AgentRecord | null;
  /** Latest persisted memory document (mutable copy for tools) */
  workingMemory: {
    messages: { role: string; content: string }[];
    toolsUsed: { name: string; arguments: Record<string, unknown>; result: string }[];
    reflections: string[];
  };
  previousMemoryRoot: string | null;
  /** When set, registers invokePeerAgent → runs peer OpenClaw turn */
  delegatePeer?: AgentRecord;
};

export type RunAgentParams = {
  systemPrompt: string;
  userInput: string;
  /** Prior OpenAI-style messages (user/assistant/system), content text only */
  memoryMessages: { role: "user" | "assistant" | "system"; content: string }[];
  toolsPrompt: string;
  maxSteps: number;
};

export type RunAgentResult = {
  reply: string;
  steps: ExecutionStep[];
  toolsUsed: { name: string; arguments: Record<string, unknown>; result: string }[];
  provider: "0g";
  /** Snapshot after turn (messages include this user/assistant exchange). */
  workingMemory: ToolContext["workingMemory"];
  /** Training corpus chunks pulled from 0G for this turn (demo / audit). */
  ragSources?: RagSource[];
};
