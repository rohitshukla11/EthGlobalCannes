/**
 * Sanity-check 0G RPC, indexer reachability, and compute provider discovery.
 * Run from repo root: npm run check:0g
 */
import { createRequire } from "node:module";
import { JsonRpcProvider } from "ethers";
import { Indexer } from "@0gfoundation/0g-ts-sdk";
import { config } from "../src/config.js";

const require = createRequire(import.meta.url);
const { createZGComputeNetworkReadOnlyBroker }: typeof import("@0glabs/0g-serving-broker") =
  require("@0glabs/0g-serving-broker");

async function main() {
  console.log("TwinNet — 0G integration check\n");

  console.log("ZG_RPC_URL:", config.zgRpc);
  const evm = new JsonRpcProvider(config.zgRpc);
  const block = await evm.getBlockNumber();
  console.log("EVM block:", block);

  console.log("\nZG_STORAGE_INDEXER_RPC:", config.zgIndexerRpc);
  const indexer = new Indexer(config.zgIndexerRpc);
  await indexer.getShardedNodes();
  console.log("Indexer: getShardedNodes OK");

  console.log("\nPrivate keys (presence only):");
  console.log("  ZG_STORAGE_PRIVATE_KEY:", config.zgStoragePrivateKey ? "set" : "MISSING");
  console.log("  ZG_COMPUTE_PRIVATE_KEY:", config.zgComputePrivateKey ? "set" : "MISSING");

  console.log("\n0G Compute providers (read-only broker):");
  const ro = await createZGComputeNetworkReadOnlyBroker(config.zgRpc);
  const list = await ro.inference.listService();
  if (!list.length) {
    console.warn("  No providers returned — inference will fail until providers are available.");
  } else {
    for (const s of list.slice(0, 8)) {
      console.log(" ", s.provider);
    }
    if (list.length > 8) console.log(`  … and ${list.length - 8} more`);
    if (config.zgInferenceProvider) {
      console.log("\nPinned ZG_INFERENCE_PROVIDER:", config.zgInferenceProvider);
    } else {
      console.log("\nUsing first provider for inference (set ZG_INFERENCE_PROVIDER to pin).");
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
