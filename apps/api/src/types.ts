export type AgentRecord = {
  id: string;
  tokenId: number;
  owner: string;
  ensFullName: string;
  name: string;
  expertise: string;
  personality: string;
  configRoot: string;
  memoryRoots: string[];
  conversationRoots: string[];
  reputation: { interactions: number; successes: number };
  createdAt: string;
};

export type DatabaseShape = {
  agents: AgentRecord[];
  ensToAgentId: Record<string, string>;
  nullifierToWallet: Record<string, string>;
};
