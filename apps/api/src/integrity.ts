import {
  resolveEnsAddress,
  getEnsAgentTexts,
  effectiveConfigRoot,
  effectiveMemoryHead,
  effectiveRuntime,
  effectiveToolsCsv,
  effectiveAgentType,
  effectiveTokenIdText,
} from "./ens.js";
import { downloadFrom0G } from "./storage0g.js";
import { readOwnerOnChain, readAgentStateOnChain } from "./inft.js";
import { config } from "./config.js";

export type AgentIntegrityReport = {
  ensName: string;
  resolvesToWallet: string | null;
  tokenId: number | null;
  contractAddress: string | null;
  ensConfigRoot: string | null;
  chainConfigRoot: string | null;
  ownerOnChain: string | null;
  walletOwnsNft: boolean;
  configRootAligned: boolean;
  configOn0gOk: boolean;
  agentType: string | null;
  memoryHead: string | null;
  memoryAccessible: boolean;
  runtime: string | null;
  tools: string | null;
  /** Identity + config + chain binding OK without local registry */
  isConsistent: boolean;
  /** ENS pointers + 0G blobs sufficient to run/reconstruct agent (no local DB required) */
  isFullyDecentralized: boolean;
};

function hexNorm(r: string): string {
  const x = r.startsWith("0x") ? r : `0x${r}`;
  return x.toLowerCase();
}

/**
 * Strong binding: ENS address ↔ NFT owner, ENS agent.config (legacy twinn.config) ↔ on-chain configRoot, 0G blobs.
 */
export async function verifyAgentIntegrity(ensName: string): Promise<AgentIntegrityReport> {
  const ens = ensName.toLowerCase();
  const resolvesToWallet = (await resolveEnsAddress(ens))?.toLowerCase() ?? null;
  const texts = await getEnsAgentTexts(ens);
  const tokenText = effectiveTokenIdText(texts);
  const tidRaw = tokenText ? Number(tokenText) : NaN;
  const tokenId = Number.isFinite(tidRaw) ? tidRaw : null;
  const cfgRaw = effectiveConfigRoot(texts);
  const ensConfigRoot = cfgRaw ? hexNorm(cfgRaw) : null;
  const agentType = effectiveAgentType(texts) ?? null;
  const memoryHead = effectiveMemoryHead(texts)?.trim() || null;
  const runtime = effectiveRuntime(texts) ?? null;
  const tools = effectiveToolsCsv(texts) ?? null;

  let ownerOnChain: string | null = null;
  let chainConfigRoot: string | null = null;
  if (tokenId !== null && config.inftAddress) {
    try {
      ownerOnChain = await readOwnerOnChain(tokenId);
      const st = await readAgentStateOnChain(tokenId);
      if (st) chainConfigRoot = hexNorm(st.configRoot);
    } catch {
      /* misconfigured */
    }
  }

  const walletOwnsNft = Boolean(
    resolvesToWallet && ownerOnChain && resolvesToWallet === ownerOnChain.toLowerCase()
  );
  const configRootAligned = Boolean(
    ensConfigRoot && chainConfigRoot && ensConfigRoot === chainConfigRoot
  );

  let configOn0gOk = false;
  const configKeyFor0g = cfgRaw;
  if (ensConfigRoot && configKeyFor0g) {
    try {
      const raw = await downloadFrom0G(configKeyFor0g);
      configOn0gOk = raw.length > 2;
    } catch {
      configOn0gOk = false;
    }
  }

  let memoryAccessible = false;
  if (memoryHead) {
    try {
      const raw = await downloadFrom0G(memoryHead);
      memoryAccessible = raw.length > 2;
    } catch {
      memoryAccessible = false;
    }
  } else {
    memoryAccessible = true;
  }

  const isConsistent = Boolean(
    tokenId !== null && walletOwnsNft && configRootAligned && configOn0gOk
  );

  const openClawRuntime = Boolean(
    runtime?.toLowerCase().includes("openclaw") || agentType?.toLowerCase() === "openclaw"
  );
  const isFullyDecentralized = Boolean(
    isConsistent &&
      openClawRuntime &&
      Boolean(ensConfigRoot) &&
      (memoryHead ? memoryAccessible : true)
  );

  return {
    ensName: ens,
    resolvesToWallet,
    tokenId,
    contractAddress: config.inftAddress || null,
    ensConfigRoot,
    chainConfigRoot,
    ownerOnChain,
    walletOwnsNft,
    configRootAligned,
    configOn0gOk,
    agentType,
    memoryHead,
    memoryAccessible,
    runtime,
    tools,
    isConsistent,
    isFullyDecentralized,
  };
}
