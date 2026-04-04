import crypto from "node:crypto";
import path from "node:path";
import { uploadBufferTo0G, uploadJsonTo0G, downloadFrom0G, downloadBufferFrom0G } from "./storage0g.js";
import {
  getAgentById,
  updateAgent,
  addTrainingDoc,
  removeTrainingDoc,
  getTrainingDocs,
} from "./db.js";
import { tryWriteCounselrTrainingRecords } from "./ens.js";
import type { TrainingDocumentRecord } from "./types.js";
import type { RagSource } from "./openclaw/types.js";

export type TrainingDocument = TrainingDocumentRecord;
export type { RagSource };

export interface TrainingManifest {
  type: "counselr-training-manifest/v1";
  agent: string;
  agentId: string;
  docCount: number;
  totalSizeBytes: number;
  documents: Array<{
    filename: string;
    hash: string;
    sizeBytes: number;
    uploadedAt: number;
    description?: string;
  }>;
  manifestHash: string;
  createdAt: number;
}

function uniqueSafeFilename(agentId: string, original: string): string {
  let safe = path.basename(original).replace(/\.\./g, "_").trim() || "unnamed";
  const existing = new Set(getTrainingDocs(agentId).map((d) => d.filename));
  if (!existing.has(safe)) return safe;
  const ext = path.extname(safe);
  const base = path.basename(safe, ext) || "file";
  return `${base}_${crypto.randomBytes(4).toString("hex")}${ext}`;
}

export async function uploadTrainingDocument(
  agentId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer,
  description?: string
): Promise<TrainingDocument> {
  const safeName = uniqueSafeFilename(agentId, filename);
  const hash = await uploadBufferTo0G(buffer);

  const doc: TrainingDocument = {
    id: crypto.randomUUID(),
    agentId,
    filename: safeName,
    mimeType,
    sizeBytes: buffer.byteLength,
    hash,
    uploadedAt: Date.now(),
    description,
  };

  addTrainingDoc(doc);
  await rebuildManifest(agentId);
  return doc;
}

export async function deleteTrainingDocument(agentId: string, docId: string): Promise<void> {
  removeTrainingDoc(agentId, docId);
  await rebuildManifest(agentId);
}

export async function rebuildManifest(agentId: string): Promise<string> {
  const agent = getAgentById(agentId);
  if (!agent) throw new Error("Agent not found");
  const docs = getTrainingDocs(agentId);
  const totalSizeBytes = docs.reduce((sum, d) => sum + d.sizeBytes, 0);

  const manifestBody: Omit<TrainingManifest, "manifestHash"> = {
    type: "counselr-training-manifest/v1",
    agent: agent.ensFullName || agentId,
    agentId,
    docCount: docs.length,
    totalSizeBytes,
    documents: docs.map((d) => ({
      filename: d.filename,
      hash: d.hash,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt,
      description: d.description,
    })),
    createdAt: Date.now(),
  };

  const manifestJson = JSON.stringify(manifestBody, null, 2);
  const manifestHash = crypto.createHash("sha256").update(manifestJson).digest("hex");
  const fullManifest: TrainingManifest = { ...manifestBody, manifestHash };

  const manifestRoot = await uploadJsonTo0G(fullManifest);

  updateAgent(agentId, {
    trainingRoot: manifestRoot,
    trainingDocCount: docs.length,
    trainingUpdatedAt: Date.now(),
  });

  if (agent.ensFullName) {
    try {
      await tryWriteCounselrTrainingRecords(agent.ensFullName, {
        trainingRoot: manifestRoot,
        docCount: docs.length,
      });
    } catch (e) {
      console.warn("ENS trainingRoot update failed:", e);
    }
  }

  return manifestRoot;
}

export async function getTrainingManifest(agentId: string): Promise<TrainingManifest | null> {
  const agent = getAgentById(agentId);
  if (!agent?.trainingRoot) return null;
  try {
    const raw = await downloadFrom0G(agent.trainingRoot);
    return JSON.parse(raw) as TrainingManifest;
  } catch {
    return null;
  }
}

export async function fetchTrainingDocument(agentId: string, filename: string): Promise<Buffer | null> {
  const docs = getTrainingDocs(agentId);
  const doc = docs.find((d) => d.filename === filename);
  if (!doc) return null;
  try {
    return await downloadBufferFrom0G(doc.hash);
  } catch {
    return null;
  }
}

export async function getTrainingRagForInference(
  agentId: string,
  userMessage: string,
  maxDocs = 2
): Promise<{ context: string; sources: RagSource[] }> {
  const docs = getTrainingDocs(agentId);
  if (!docs.length) return { context: "", sources: [] };

  const msgWords = userMessage.toLowerCase().split(/\s+/).filter(Boolean);

  const scored = docs.map((doc) => {
    const nameWords = doc.filename.toLowerCase().split(/[\s._-]+/);
    const descWords = (doc.description || "").toLowerCase().split(/\s+/);
    const allWords = [...nameWords, ...descWords];
    const score = msgWords.filter((w) => allWords.some((dw) => dw.includes(w) || w.includes(dw))).length;
    return { doc, score };
  });

  scored.sort((a, b) => b.score - a.score);

  let picked = scored
    .slice(0, maxDocs)
    .filter((s) => s.score > 0 || docs.length <= maxDocs)
    .map((s) => s.doc);

  if (!picked.length) {
    picked = docs.slice(0, maxDocs);
  }

  const sources: RagSource[] = [];
  const contexts: string[] = [];

  for (const doc of picked) {
    try {
      const content = await downloadBufferFrom0G(doc.hash);
      const isText =
        doc.mimeType === "text/plain" ||
        doc.mimeType === "text/markdown" ||
        doc.mimeType === "application/json";
      const text = isText
        ? content.toString("utf-8").slice(0, 2000)
        : `[Non-text training file (${doc.mimeType}): ${doc.filename} — use filename/metadata only]`;
      contexts.push(`[TRAINING DOC: ${doc.filename} | 0G:${doc.hash.slice(0, 10)}]\n${text}`);
      sources.push({ filename: doc.filename, hash: doc.hash });
    } catch {
      /* skip */
    }
  }

  return { context: contexts.join("\n\n---\n\n"), sources };
}
