export type AgentPricing = {
  /** Amount in wei (string) or mock token units */
  pricePerRequest: string;
  ownerWallet: string;
  currency?: string;
};

export type PersonalitySliders = {
  humor: number;
  tone: number;
  intelligence: number;
};

export type ConfigVersionEntry = {
  version: number;
  configRoot: string;
  at: string;
};

export type AgentRecord = {
  /** Canonical: `ens:name.eth` for protocol-native agents; legacy deployments may still use UUIDs. */
  id: string;
  tokenId: number;
  owner: string;
  ensFullName: string;
  name: string;
  /** Short pitch / value proposition (shown on marketplace cards). */
  expertise: string;
  personality: string;
  /** Professional role label, e.g. Lawyer, Trader. */
  profession?: string;
  /** Focus area, e.g. Crypto compliance. */
  specialization?: string;
  /** Credibility line, e.g. years of practice. */
  experience?: string;
  /** formal | friendly | analytical */
  advisorTone?: string;
  /** Optional override from 0G config JSON (v1 agent schema). */
  systemPrompt?: string;
  configRoot: string;
  memoryRoots: string[];
  conversationRoots: string[];
  reputation: { interactions: number; successes: number };
  createdAt: string;
  /** Optional monetization (wei string + payout address) */
  pricing?: AgentPricing;
  /** UI sliders 0–100 */
  personalitySliders?: PersonalitySliders;
  /** Monotonic config version; new roots appended on reflection / rollback */
  configVersion?: number;
  configHistory?: ConfigVersionEntry[];
  /** Roots of long-term / reflection blobs on 0G */
  longTermRoots?: string[];
  /** Cumulative user turns since last reflection (for /agent/request) */
  turnsSinceReflection?: number;
  /** Operator published agent.worldId (legacy: twinn.worldId) via API */
  ensHumanVerifiedHint?: boolean;
  /** From ENS agent.type (e.g. openclaw) */
  agentType?: string;
  /** Latest OpenClaw memory head from ENS agent.memory (optional cache mirror) */
  ensMemoryHead?: string;
  /** Latest training manifest root on 0G (verifiable corpus) */
  trainingRoot?: string;
  trainingDocCount?: number;
  trainingUpdatedAt?: number;
};

export type TrainingDocumentRecord = {
  id: string;
  agentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  /** 0G Storage content root hash */
  hash: string;
  uploadedAt: number;
  description?: string;
};

export type DatabaseShape = {
  agents: AgentRecord[];
  ensToAgentId: Record<string, string>;
  nullifierToWallet: Record<string, string>;
  trainingDocs?: TrainingDocumentRecord[];
};

/** Public discovery row (local registry + optional 0G manifest) */
export type AgentIndexEntry = {
  id: string;
  ensFullName: string;
  owner: string;
  tokenId: number;
  configRoot: string;
  updatedAt: string;
  source?: "local" | "manifest" | "chain";
};
