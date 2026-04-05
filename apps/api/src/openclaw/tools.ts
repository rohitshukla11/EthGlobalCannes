import { formatEther } from "viem";
import { createPublicClient, http, isAddress } from "viem";
import { sepolia } from "viem/chains";
import { config } from "../config.js";
import { uploadJsonTo0G, downloadFrom0G } from "../storage0g.js";
import { getEnsAgentTexts, resolveFullAgentProfile } from "../ens.js";
import type { ToolCallPayload, ToolContext, OpenClawToolName } from "./types.js";

const MAX_MEMORY_CHARS = 12000;

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

/** ENS/config tools only run when the user actually typed that name — stops placeholder names like yourproject.eth. */
export function userMessageContainsEnsName(userText: string, nameRaw: string): boolean {
  const name = nameRaw.trim().toLowerCase();
  if (!name.endsWith(".eth") || name.length < 4) return false;
  return userText.toLowerCase().includes(name);
}

async function toolGetMemory(ctx: ToolContext): Promise<string> {
  const lines = ctx.workingMemory.messages.map((m) => `[${m.role}] ${truncate(m.content, 2000)}`);
  return truncate(lines.join("\n"), MAX_MEMORY_CHARS) || "(empty)";
}

async function toolSaveMemory(ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const note = typeof args.note === "string" ? args.note : JSON.stringify(args);
  ctx.workingMemory.reflections.push(`${new Date().toISOString()}: ${note.slice(0, 4000)}`);
  return "saved to reflection buffer (persisted with this turn)";
}

async function toolFetchENSProfile(_ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const name = typeof args.name === "string" ? args.name : "";
  if (!name) return "error: name required";
  const key = name.toLowerCase();
  const texts = await getEnsAgentTexts(key);
  const hasProtocolRecords =
    Object.keys(texts).some((k) => k.startsWith("twinn.") || k.startsWith("agent.")) ||
    Boolean(texts.description);
  if (!hasProtocolRecords) {
    return JSON.stringify(
      {
        name: key,
        records: texts,
        _note:
          "No Alter protocol (agent.*) text records on Sepolia for this name (legacy twinn.* may exist on older names). Many public .eth names only have data on Ethereum mainnet; Alter reads the Sepolia resolver only. Use knowledge lookup or another tool if the user did not ask specifically for this ENS on Sepolia.",
      },
      null,
      2
    );
  }
  return JSON.stringify(texts, null, 2);
}

async function toolFetchAgentConfig(_ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const name = typeof args.name === "string" ? args.name : "";
  if (!name) return "error: name required";
  const profile = await resolveFullAgentProfile(name.toLowerCase());
  if (!profile) return "not found";
  return JSON.stringify(
    {
      ens: profile.ensFullName,
      texts: profile.texts,
      configSummary: profile.configJson
        ? {
            name: profile.configJson.name,
            version: profile.configJson.version,
            expertise: profile.configJson.expertise,
          }
        : null,
    },
    null,
    2
  );
}

async function toolMockWebSearch(_ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const query = typeof args.query === "string" ? args.query : "";
  return JSON.stringify({
    query,
    results: [
      { title: "Reference 1", snippet: `Curated context for: ${query.slice(0, 80)}` },
      {
        title: "Reference 2",
        snippet:
          "Cross-check with getMemory if prior turns matter. Do not call ENS tools unless the user typed a .eth name in their message.",
      },
    ],
  });
}

async function toolReadEthBalance(_ctx: ToolContext, args: Record<string, unknown>): Promise<string> {
  const address = typeof args.address === "string" ? args.address : "";
  if (!isAddress(address)) return "error: invalid address";
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  try {
    const bal = await client.getBalance({ address });
    return JSON.stringify({ chain: "sepolia", address, balanceWei: bal.toString(), balanceEth: formatEther(bal) });
  } catch (e) {
    return `error: ${String(e)}`;
  }
}

export type InvokePeerFn = (peerEns: string, message: string) => Promise<string>;

export function createToolExecutor(ctx: ToolContext, invokePeer?: InvokePeerFn) {
  return async function executeTool(call: ToolCallPayload): Promise<string> {
    const name = call.name as OpenClawToolName;
    const args = call.arguments ?? {};
    switch (name) {
      case "getMemory":
        return toolGetMemory(ctx);
      case "saveMemory":
        return toolSaveMemory(ctx, args);
      case "fetchENSProfile": {
        const ensName = typeof args.name === "string" ? args.name : "";
        if (!userMessageContainsEnsName(ctx.currentTurnUserText, ensName)) {
          return JSON.stringify({
            error: "skipped",
            reason:
              "fetchENSProfile only runs when the user message explicitly contains that exact .eth name. Never invent names (e.g. yourproject.eth). Use mockWebSearch or getMemory, or answer directly from training and expertise.",
          });
        }
        return toolFetchENSProfile(ctx, args);
      }
      case "fetchAgentConfig": {
        const cfgName = typeof args.name === "string" ? args.name : "";
        if (!userMessageContainsEnsName(ctx.currentTurnUserText, cfgName)) {
          return JSON.stringify({
            error: "skipped",
            reason:
              "fetchAgentConfig only runs when the user message explicitly contains that exact .eth name. Never invent placeholder ENS. Use mockWebSearch or answer directly.",
          });
        }
        return toolFetchAgentConfig(ctx, args);
      }
      case "mockWebSearch":
        return toolMockWebSearch(ctx, args);
      case "readEthBalance":
        return toolReadEthBalance(ctx, args);
      case "invokePeerAgent": {
        if (!invokePeer) return "error: invokePeerAgent not available in this context";
        const targetEns = typeof args.targetEns === "string" ? args.targetEns : "";
        const message = typeof args.message === "string" ? args.message : "";
        if (!targetEns || !message) return "error: targetEns and message required";
        return invokePeer(targetEns, message);
      }
      default:
        return `error: unknown tool ${call.name}`;
    }
  };
}

/** Optional: persist arbitrary JSON blob (tool may return root to user) */
export async function persistToolArtifact(payload: object): Promise<string> {
  return uploadJsonTo0G(payload);
}

export async function loadRootJson(root: string): Promise<unknown> {
  const raw = await downloadFrom0G(root);
  return JSON.parse(raw) as unknown;
}
