import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MemData, Indexer } from "@0gfoundation/0g-ts-sdk";
import { Wallet, JsonRpcProvider } from "ethers";
import { assertProduction0G, config } from "./config.js";

let indexer: Indexer | null = null;
let signer: Wallet | null = null;

function getIndexer() {
  if (!indexer) indexer = new Indexer(config.zgIndexerRpc);
  return indexer;
}

function getSigner() {
  assertProduction0G();
  if (!signer) {
    const provider = new JsonRpcProvider(config.zgRpc);
    signer = new Wallet(config.zgStoragePrivateKey, provider);
  }
  return signer;
}

/** Upload UTF-8 JSON or text to 0G Storage; returns root hash (hex). */
export async function uploadJsonTo0G(payload: object | string): Promise<string> {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const bytes = new TextEncoder().encode(text);
  const mem = new MemData(Array.from(bytes));
  const [tree, treeErr] = await mem.merkleTree();
  if (treeErr) throw new Error(`0G merkleTree: ${treeErr}`);
  const ind = getIndexer();
  const [tx, err] = await ind.upload(mem, config.zgRpc, getSigner() as never);
  if (err) throw new Error(`0G upload: ${err}`);
  if ("rootHash" in tx) return tx.rootHash as string;
  if ("rootHashes" in tx && tx.rootHashes.length) return tx.rootHashes[0] as string;
  throw new Error("0G upload: unexpected tx shape");
}

/** Download by root hash; returns UTF-8 string. */
export async function downloadFrom0G(rootHash: string): Promise<string> {
  const buf = await downloadBufferFrom0G(rootHash);
  return buf.toString("utf-8");
}

/** Download by root hash; returns raw bytes. */
export async function downloadBufferFrom0G(rootHash: string): Promise<Buffer> {
  const ind = getIndexer();
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "counselr-0g-"));
  const out = path.join(dir, "blob");
  const dlErr = await ind.download(rootHash, out, true);
  if (dlErr) throw new Error(`0G download: ${dlErr}`);
  const buf = await fs.promises.readFile(out);
  await fs.promises.rm(dir, { recursive: true, force: true });
  return buf;
}

/** Upload arbitrary bytes to 0G Storage; returns root hash (hex). */
export async function uploadBufferTo0G(buffer: Buffer): Promise<string> {
  const mem = new MemData(Array.from(buffer));
  const [tree, treeErr] = await mem.merkleTree();
  if (treeErr) throw new Error(`0G merkleTree: ${treeErr}`);
  const ind = getIndexer();
  const [tx, err] = await ind.upload(mem, config.zgRpc, getSigner() as never);
  if (err) throw new Error(`0G upload: ${err}`);
  if ("rootHash" in tx) return tx.rootHash as string;
  if ("rootHashes" in tx && tx.rootHashes.length) return tx.rootHashes[0] as string;
  throw new Error("0G upload: unexpected tx shape");
}
