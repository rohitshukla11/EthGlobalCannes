/** Discovery row from GET /agents */
export type MarketplaceAgent = {
  id: string;
  ensFullName: string;
  name: string;
  owner: string;
  tokenId: number;
  reputation: { interactions: number; successes: number };
  type: string;
  source?: string;
  verifiedHumanTwin?: boolean;
  openClawAgent?: boolean;
  configRoot: string;
  memoryHead: string | null;
  personality: string;
  expertise: string;
  personalitySliders: PersonalitySliders | null;
};

export type PersonalitySliders = {
  humor: number;
  tone: number;
  intelligence: number;
};

/** GET /agents/:id or by-ens public agent */
export type PublicAgent = {
  id: string;
  ensFullName: string;
  name: string;
  expertise: string;
  personality: string;
  owner: string;
  tokenId: number;
  configRoot: string;
  reputation: { interactions: number; successes: number };
  personalitySliders?: PersonalitySliders | null;
  verifiedHumanTwin?: boolean;
  openClawAgent?: boolean;
  memoryHead?: string | null;
};

export type ExecutionLogPayload = {
  mode?: string;
  steps?: ExecutionStepPayload[];
  toolsUsed?: unknown[];
} | null;

export type ExecutionStepPayload = {
  kind?: string;
  step?: number;
  detail?: string;
  tool?: string;
  shortSummary?: string;
};

export type AgentRequestResponse = {
  reply: string;
  memoryRoot?: string;
  memoryRootBefore?: string | null;
  memoryRootAfter?: string;
  reflectionTriggered?: boolean;
  agentId: string;
  openClaw?: boolean;
  executionLog?: ExecutionLogPayload;
};

export type DelegateResponse = {
  reply: string;
  memoryRoot?: string;
  conversation: { from: "A" | "B"; message: string }[];
  executionLog?: ExecutionLogPayload;
  agentA: { id: string; ensFullName: string };
  agentB: { id: string; ensFullName: string };
};
