import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* Monorepo: `.env` usually lives at repo root; `npm run dev -w @alter/api` cwd is `apps/api`,
   so default `dotenv/config` never saw root `.env`. Load both; `apps/api/.env` overrides. */
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/** 32-byte secp256k1 private key as hex (ethers v6 rejects placeholders like `0x...`). */
export function assertValidPrivateKey(envName: string, value: string): void {
  const v = value.trim();
  if (!v) throw new Error(`${envName} is required`);
  if (v === "0x..." || v === "0x…") {
    throw new Error(
      `${envName} is still a placeholder in .env — replace it with a real 0x-prefixed 64-hex-character private key`
    );
  }
  const hex = v.startsWith("0x") ? v.slice(2) : v;
  if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(`${envName} must be 64 hex characters (with or without 0x prefix)`);
  }
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  host: opt("HOST", "0.0.0.0"),
  jwtSecret: opt("JWT_SECRET", "dev-insecure-change-me"),
  publicApiUrl: opt("PUBLIC_API_URL", "http://localhost:4000"),
  corsOrigin: opt("CORS_ORIGIN", "http://localhost:3000"),

  zgRpc: opt("ZG_RPC_URL", "https://evmrpc-testnet.0g.ai"),
  zgIndexerRpc: opt("ZG_STORAGE_INDEXER_RPC", "https://indexer-storage-testnet-turbo.0g.ai"),
  zgExplorerUrl: opt("ZG_EXPLORER_URL", "https://chainscan-galileo.0g.ai"),
  /** Storage blob / Merkle root pages (not ChainScan — use /submission/0x…). */
  zgStorageScanUrl: opt("ZG_STORAGE_SCAN_URL", "https://storagescan-galileo.0g.ai"),
  zgStoragePrivateKey: opt("ZG_STORAGE_PRIVATE_KEY", ""),
  zgComputePrivateKey: opt("ZG_COMPUTE_PRIVATE_KEY", ""),

  zgInferenceProvider: opt("ZG_INFERENCE_PROVIDER", ""),

  /**
   * Optional OpenAI-compatible HTTP proxy for 0G-backed inference (e.g. Integrate Network).
   * When both URL and API key are set, `infer0GChat` uses POST {url}/chat/completions with Bearer auth
   * instead of the 0G serving broker. Same request shape as the official OpenAI SDK.
   */
  zgComputeProxyBaseUrl: opt("ZG_COMPUTE_PROXY_URL", "").trim(),
  zgComputeProxyApiKey: opt("ZG_COMPUTE_PROXY_API_KEY", "").trim(),
  zgComputeProxyModel:
    opt("ZG_COMPUTE_PROXY_MODEL", "qwen/qwen-2.5-7b-instruct").trim() || "qwen/qwen-2.5-7b-instruct",

  sepoliaRpc: opt("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
  ensOperatorPrivateKey: opt("ENS_OPERATOR_PRIVATE_KEY", ""),

  inftAddress: opt("INFT_CONTRACT_ADDRESS", ""),
  inftOwnerPrivateKey: opt("INFT_OWNER_PRIVATE_KEY", ""),

  /** `{root}` / `{metadataRoot}` replaced with 0x-prefixed root. Default: alter-0g-metadata:0x… (no Alter API). */
  nftTokenUriTemplate: opt("NFT_TOKEN_URI_TEMPLATE", ""),

  /** If true, POST /agents also writes into registry.json so GET /agents / marketplace lists new mints immediately. */
  persistAgentsLocally: opt("PERSIST_AGENTS_LOCALLY", "true") === "true",

  wldRpId: opt("WLD_RP_ID", ""),
  wldAppId: opt("WLD_APP_ID", ""),
  wldSigningKeyHex: opt("WLD_SIGNING_KEY_HEX", ""),
  wldAction: opt("WLD_ACTION", "alter-verify"),
  wldEnvironment: (opt("WLD_ENVIRONMENT", "production") as "production" | "staging") || "production",

  dataDir: opt("DATA_DIR", "./data"),

  /** local | ens | hybrid — hybrid merges 0G manifest + file registry (default local). */
  discoveryMode: (opt("DISCOVERY_MODE", "local") as "local" | "ens" | "hybrid") || "local",
  /** 0G Storage root hash of agent index JSON (see manifest0g.ts). Optional; enables decentralized listing. */
  agentIndexRoot: opt("AGENT_INDEX_ROOT", ""),
  /** Sepolia ENS name whose resolver stores agent.manifest (legacy: twinn.manifest) = latest AGENT_INDEX_ROOT. */
  ensIndexName: opt("ENS_INDEX_NAME", ""),

  /** Comma-ordered inference providers: 0g,mock,openai */
  computeProviders: opt("COMPUTE_PROVIDERS", "0g")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  computeMockResponse: opt(
    "COMPUTE_MOCK_RESPONSE",
    "[mock] Configure COMPUTE_PROVIDERS=0g for real inference. Acknowledged: "
  ),
  openaiApiKey: opt("OPENAI_API_KEY", ""),
  openaiModel: opt("OPENAI_MODEL", "gpt-4o-mini"),
  openaiBaseUrl: opt("OPENAI_BASE_URL", "https://api.openai.com/v1"),

  /** off | mock — mock accepts free calls; extend for on-chain later */
  paymentMode: (opt("PAYMENT_MODE", "off") as "off" | "mock") || "off",

  /** Run config reflection every N successful user turns (0 disables) */
  reflectionEveryN: Number(process.env.REFLECTION_EVERY_N ?? "0"),

  /** If true, legacy inference uses only 0G Compute (no mock/OpenAI fallback). OpenClaw already uses 0G only. */
  strict0gMode: opt("STRICT_0G_MODE", "false") === "true",
};

export function assertProduction0G() {
  assertValidPrivateKey("ZG_STORAGE_PRIVATE_KEY", config.zgStoragePrivateKey);
  assertValidPrivateKey("ZG_COMPUTE_PRIVATE_KEY", config.zgComputePrivateKey);
}

export function assertINFT() {
  if (!config.inftAddress || config.inftAddress === "0x...") {
    throw new Error("INFT_CONTRACT_ADDRESS required (deploy TwinAgentINFT to 0G and set the address)");
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(config.inftAddress.trim())) {
    throw new Error("INFT_CONTRACT_ADDRESS must be a 40-hex-character address (0x-prefixed)");
  }
  assertValidPrivateKey("INFT_OWNER_PRIVATE_KEY", config.inftOwnerPrivateKey);
}

export function assertWorldId() {
  if (!config.wldRpId) throw new Error("WLD_RP_ID required (World Developer Portal)");
  if (!config.wldSigningKeyHex) throw new Error("WLD_SIGNING_KEY_HEX required");
  if (!config.wldAppId) throw new Error("WLD_APP_ID required (app_… from Developer Portal)");
}
