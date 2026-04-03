import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/* Monorepo: `.env` usually lives at repo root; `npm run dev -w @twinnet/api` cwd is `apps/api`,
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
  zgStoragePrivateKey: opt("ZG_STORAGE_PRIVATE_KEY", ""),
  zgComputePrivateKey: opt("ZG_COMPUTE_PRIVATE_KEY", ""),

  zgInferenceProvider: opt("ZG_INFERENCE_PROVIDER", ""),

  sepoliaRpc: opt("SEPOLIA_RPC_URL", "https://ethereum-sepolia-rpc.publicnode.com"),
  ensOperatorPrivateKey: opt("ENS_OPERATOR_PRIVATE_KEY", ""),

  inftAddress: opt("INFT_CONTRACT_ADDRESS", ""),
  inftOwnerPrivateKey: opt("INFT_OWNER_PRIVATE_KEY", ""),

  wldRpId: opt("WLD_RP_ID", ""),
  wldAppId: opt("WLD_APP_ID", ""),
  wldSigningKeyHex: opt("WLD_SIGNING_KEY_HEX", ""),
  wldAction: opt("WLD_ACTION", "twinnet-verify"),
  wldEnvironment: (opt("WLD_ENVIRONMENT", "production") as "production" | "staging") || "production",

  dataDir: opt("DATA_DIR", "./data"),
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
