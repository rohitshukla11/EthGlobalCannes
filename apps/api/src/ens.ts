import { createPublicClient, createWalletClient, http, type Hex, type Address } from "viem";
import { namehash, normalize } from "viem/ens";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "./config.js";

const publicResolverAbi = [
  {
    name: "setText",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "node", type: "bytes32" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
] as const;

export async function resolveEnsAddress(name: string): Promise<Address | null> {
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  try {
    const addr = await client.getEnsAddress({ name: normalize(name) });
    return addr;
  } catch {
    return null;
  }
}

export async function getEnsAgentMeta(name: string): Promise<{ agentId?: string; tokenId?: string }> {
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  try {
    const n = normalize(name);
    const [agentId, tokenId] = await Promise.all([
      client.getEnsText({ name: n, key: "twinn.agentId" }),
      client.getEnsText({ name: n, key: "twinn.tokenId" }),
    ]);
    return { agentId: agentId || undefined, tokenId: tokenId || undefined };
  } catch {
    return {};
  }
}

/** Writes twinn.* text records when ENS_OPERATOR_PRIVATE_KEY controls the name's resolver on Sepolia. */
export async function tryWriteEnsTwinRecords(fullName: string, agentId: string, tokenId: number): Promise<boolean> {
  const pk = config.ensOperatorPrivateKey;
  if (!pk) return false;
  const account = privateKeyToAccount(pk as Hex);
  const client = createPublicClient({ chain: sepolia, transport: http(config.sepoliaRpc) });
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(config.sepoliaRpc),
  });
  const resolver = await client.getEnsResolver({ name: normalize(fullName) });
  if (!resolver) return false;
  const node = namehash(normalize(fullName)) as Hex;
  for (const [key, value] of [
    ["twinn.agentId", agentId],
    ["twinn.tokenId", String(tokenId)],
    ["description", `TwinNet AI agent — token ${tokenId}`],
  ] as const) {
    const hash = await wallet.writeContract({
      address: resolver,
      abi: publicResolverAbi,
      functionName: "setText",
      args: [node, key, value],
    });
    await client.waitForTransactionReceipt({ hash });
  }
  return true;
}
