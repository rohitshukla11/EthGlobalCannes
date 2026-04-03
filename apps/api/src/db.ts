import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AgentRecord, DatabaseShape } from "./types.js";
import { config } from "./config.js";

const filePath = () => path.join(config.dataDir, "registry.json");

function load(): DatabaseShape {
  try {
    const raw = fs.readFileSync(filePath(), "utf-8");
    return JSON.parse(raw) as DatabaseShape;
  } catch {
    return { agents: [], ensToAgentId: {}, nullifierToWallet: {} };
  }
}

function save(db: DatabaseShape) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.writeFileSync(filePath(), JSON.stringify(db, null, 2), "utf-8");
}

let cache: DatabaseShape | null = null;

export function getDb(): DatabaseShape {
  if (!cache) cache = load();
  return cache;
}

function persist() {
  if (cache) save(cache);
}

export function setWalletForNullifier(nullifier: string, wallet: string) {
  const db = getDb();
  db.nullifierToWallet[nullifier.toLowerCase()] = wallet.toLowerCase();
  persist();
}

export function getWalletForNullifier(nullifier: string): string | undefined {
  return getDb().nullifierToWallet[nullifier.toLowerCase()];
}

export function listAgents(): AgentRecord[] {
  return [...getDb().agents];
}

export function getAgentById(id: string): AgentRecord | undefined {
  return getDb().agents.find((a) => a.id === id);
}

export function getAgentByEns(name: string): AgentRecord | undefined {
  const key = name.toLowerCase();
  const id = getDb().ensToAgentId[key];
  if (!id) return undefined;
  return getAgentById(id);
}

export function getAgentByTokenId(tokenId: number): AgentRecord | undefined {
  return getDb().agents.find((a) => a.tokenId === tokenId);
}

export function insertAgent(agent: AgentRecord) {
  const db = getDb();
  db.agents.push(agent);
  db.ensToAgentId[agent.ensFullName.toLowerCase()] = agent.id;
  persist();
}

export function updateAgent(id: string, patch: Partial<AgentRecord>) {
  const db = getDb();
  const i = db.agents.findIndex((a) => a.id === id);
  if (i < 0) return;
  const prev = db.agents[i]!;
  const next = { ...prev, ...patch };
  if (prev.ensFullName !== next.ensFullName) {
    delete db.ensToAgentId[prev.ensFullName.toLowerCase()];
    db.ensToAgentId[next.ensFullName.toLowerCase()] = next.id;
  }
  db.agents[i] = next;
  persist();
}

export function newAgentId() {
  return randomUUID();
}
