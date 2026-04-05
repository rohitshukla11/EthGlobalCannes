import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Indexer } from "@0glabs/0g-ts-sdk";

/** 0G Galileo Testnet (Turbo) indexer — REST + SDK RPC base. */
const DEFAULT_INDEXER_BASE = "https://indexer-storage-testnet-turbo.0g.ai";

function indexerBaseUrl(): string {
  const fromEnv = process.env.ZG_STORAGE_INDEXER_RPC?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv.replace(/\/$/, "") : DEFAULT_INDEXER_BASE;
}

const ROOT_HASH_RE = /^0x[a-fA-F0-9]{64}$/;

export interface ZeroGFileInfo {
  tx: {
    dataMerkleRoot: string;
    size: number;
    seq: number;
    startEntryIndex: number;
  };
  finalized: boolean;
  isCached: boolean;
  uploadedSegNum: number;
  pruned: boolean;
}

export interface ZeroGFileInfoSummary {
  size: number;
  finalized: boolean;
  pruned: boolean;
  seq: number;
}

interface IndexerErrorBody {
  code: number;
  message: string;
  data: unknown;
}

function isIndexerErrorBody(x: unknown): x is IndexerErrorBody {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.code === "number" && typeof o.message === "string";
}

function parseZeroGFileInfo(x: unknown): ZeroGFileInfo | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (typeof r.finalized !== "boolean" || typeof r.pruned !== "boolean") return null;
  const tx = r.tx;
  if (typeof tx !== "object" || tx === null) return null;
  const t = tx as Record<string, unknown>;
  if (
    typeof t.dataMerkleRoot !== "string" ||
    typeof t.size !== "number" ||
    typeof t.seq !== "number" ||
    typeof t.startEntryIndex !== "number"
  ) {
    return null;
  }
  const isCached = typeof r.isCached === "boolean" ? r.isCached : false;
  const uploadedSegNum = typeof r.uploadedSegNum === "number" ? r.uploadedSegNum : 0;
  return {
    tx: {
      dataMerkleRoot: t.dataMerkleRoot,
      size: t.size,
      seq: t.seq,
      startEntryIndex: t.startEntryIndex,
    },
    finalized: r.finalized,
    isCached,
    uploadedSegNum,
    pruned: r.pruned,
  };
}

/** Flat indexer summary (when REST omits nested `tx`). */
function parseFlatSummary(x: unknown): ZeroGFileInfoSummary | null {
  if (typeof x !== "object" || x === null) return null;
  const r = x as Record<string, unknown>;
  if (
    typeof r.size !== "number" ||
    typeof r.finalized !== "boolean" ||
    typeof r.pruned !== "boolean" ||
    typeof r.seq !== "number"
  ) {
    return null;
  }
  return { size: r.size, finalized: r.finalized, pruned: r.pruned, seq: r.seq };
}

function unwrapPayload(raw: unknown): unknown {
  if (typeof raw === "object" && raw !== null && "data" in raw) {
    const d = (raw as { data: unknown }).data;
    if (d !== null && d !== undefined) return d;
  }
  return raw;
}

/** Throws if `rootHash` is not `0x` + 64 hex chars. */
export function assertValidRootHash(rootHash: string): void {
  const s = rootHash.trim();
  if (!ROOT_HASH_RE.test(s)) {
    console.error("[0g-storage] Invalid root hash format:", rootHash);
    throw new Error("Invalid root hash format");
  }
}

function toSummary(info: ZeroGFileInfo): ZeroGFileInfoSummary {
  return {
    size: info.tx.size,
    finalized: info.finalized,
    pruned: info.pruned,
    seq: info.tx.seq,
  };
}

let indexerSingleton: Indexer | null = null;

function getIndexer(): Indexer {
  if (!indexerSingleton) indexerSingleton = new Indexer(indexerBaseUrl());
  return indexerSingleton;
}

/**
 * GET {indexer}/file/info/{rootHash}
 * @returns Summary fields or `null` if the indexer reports the file as missing.
 */
export async function getFileInfo(rootHash: string): Promise<ZeroGFileInfoSummary | null> {
  try {
    assertValidRootHash(rootHash);
    const base = indexerBaseUrl();
    const url = `${base}/file/info/${rootHash.trim()}`;
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });

    const raw: unknown = await res.json().catch(() => null);
    if (raw === null) {
      console.error("[0g-storage] getFileInfo: invalid JSON from indexer", res.status);
      throw new Error(`Indexer file info: HTTP ${res.status}`);
    }

    if (isIndexerErrorBody(raw)) {
      if (raw.code === 101 || /not found/i.test(raw.message)) {
        return null;
      }
      console.error("[0g-storage] getFileInfo indexer error:", raw.code, raw.message);
      throw new Error(`Indexer file info: ${raw.message}`);
    }

    const payload = unwrapPayload(raw);

    if (!res.ok) {
      if (res.status === 404) return null;
      console.error("[0g-storage] getFileInfo HTTP error:", res.status, raw);
      throw new Error(`Indexer file info: HTTP ${res.status}`);
    }

    const nested = parseZeroGFileInfo(payload);
    if (nested) return toSummary(nested);

    const flat = parseFlatSummary(payload);
    if (flat) return flat;

    console.error("[0g-storage] getFileInfo: unexpected response shape", raw);
    throw new Error("Indexer file info: unexpected response shape");
  } catch (e) {
    if (e instanceof Error && e.message === "Invalid root hash format") throw e;
    console.error("[0g-storage] getFileInfo failed:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

/**
 * Download file bytes via `@0glabs/0g-ts-sdk` `Indexer.download` into memory (temp file is removed).
 */
export async function downloadFile(rootHash: string): Promise<Buffer> {
  try {
    assertValidRootHash(rootHash);
    const info = await getFileInfo(rootHash);
    if (info === null) {
      console.error("[0g-storage] downloadFile: file not found", rootHash);
      throw new Error("File not found");
    }
    if (info.pruned) {
      console.error("[0g-storage] downloadFile: pruned", rootHash);
      throw new Error("File has been pruned");
    }
    if (!info.finalized) {
      console.error("[0g-storage] downloadFile: not finalized", rootHash);
      throw new Error("File not finalized");
    }

    const ind = getIndexer();
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "next-0g-"));
    const outPath = path.join(dir, "blob");
    try {
      const dlErr = await ind.download(rootHash.trim(), outPath, true);
      if (dlErr) {
        console.error("[0g-storage] Indexer.download error:", dlErr);
        throw new Error(`Download failed: ${dlErr.message}`);
      }
      const buf = await fs.promises.readFile(outPath);
      return buf;
    } finally {
      await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === "Invalid root hash format" ||
        e.message === "File not found" ||
        e.message === "File has been pruned" ||
        e.message === "File not finalized")
    ) {
      throw e;
    }
    console.error("[0g-storage] downloadFile failed:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function downloadAsText(rootHash: string): Promise<string> {
  try {
    const buf = await downloadFile(rootHash);
    return buf.toString("utf8");
  } catch (e) {
    console.error("[0g-storage] downloadAsText failed:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}

export async function downloadAsJSON<T>(rootHash: string): Promise<T> {
  try {
    const text = await downloadAsText(rootHash);
    return JSON.parse(text) as T;
  } catch (e) {
    if (e instanceof SyntaxError) {
      console.error("[0g-storage] downloadAsJSON: JSON parse error:", e);
      throw new Error(`Download failed: invalid JSON (${e.message})`);
    }
    console.error("[0g-storage] downloadAsJSON failed:", e);
    throw e instanceof Error ? e : new Error(String(e));
  }
}
