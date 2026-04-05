import type { FastifyInstance, FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { isAddress } from "viem";
import { buildRpContext, verifyWorldProof } from "./worldId.js";
import { config, assertWorldId } from "./config.js";
import {
  getDb,
  getAgentByEns,
  getAgentById,
  insertAgent,
  ensureAgentCacheForMutation,
  setWalletForNullifier,
  getWalletForNullifier,
  updateAgent,
  getTrainingDocs,
} from "./db.js";
import { uploadJsonTo0G, downloadFrom0G } from "./storage0g.js";
import {
  mintAgentINFT,
  appendIntelligentDataOnChain,
  readAgentStateOnChain,
  readTokenURIOnChain,
  readOwnerOnChain,
  fetchAgentUpdatedLogs,
  fetchAgentCreatedLogs,
} from "./inft.js";
import {
  tryWriteEnsTwinRecords,
  tryWriteEnsIndexManifest,
  updateEnsMemoryHead,
  resolveEnsAddress,
  getEnsAgentMeta,
  getEnsAgentTexts,
  effectiveConfigRoot,
  hasAgentNamespaceRecords,
} from "./ens.js";
import {
  ADVISOR_CRITICAL_RULES_FOOTER,
  buildAdvisorPrompt,
  persistMemorySnippet,
  runUnifiedAgentTurn,
} from "./agentLogic.js";
import { cleanResponse } from "./openclaw/responseFormatter.js";
import { is0GComputeProxyActive } from "./compute0g.js";
import {
  listDiscoverableAgents,
  getAgentResilientById,
  getAgentResilientByEns,
  resolveAgentByConfigRoot,
  resolveAgent,
} from "./indexer.js";
import { appendManifestEntry } from "./manifest0g.js";
import { assertPaymentOrContinue } from "./payments.js";
import { buildProofHash, persistAttestation } from "./verifiability.js";
import {
  bumpReflectionCounter,
  maybeRunReflection,
  loadLatestClawMemory,
  mergeClawMemoryForTurn,
} from "./memoryEngine.js";
import { verifyAgentIntegrity } from "./integrity.js";
import {
  buildWeb3ArchitectSystemPrompt,
  getWeb3ArchitectKnowledgeBase,
  getWeb3ArchitectTrainingData,
  isWeb3ArchitectProfession,
} from "./web3Architect.js";
import { agentRecordIsOpenClaw, listRowIsOpenClaw } from "./agentOpenClaw.js";
import type { AgentRecord } from "./types.js";
import type { RagSource } from "./openclaw/types.js";
import {
  uploadTrainingDocument,
  deleteTrainingDocument,
  getTrainingManifest,
  verifyTrainingDocumentStorage,
} from "./trainingData.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
  }
}

type Authed = { nullifier: string };

function auth(request: FastifyRequest): Authed {
  const n = request.user?.sub;
  if (!n) throw Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  return { nullifier: n };
}

const verifyBodySchema = z.object({}).passthrough();

const walletBodySchema = z.object({
  wallet: z.string().refine((w) => isAddress(w), "Invalid wallet"),
});

const sliderSchema = z.object({
  humor: z.number().min(0).max(100),
  tone: z.number().min(0).max(100),
  intelligence: z.number().min(0).max(100),
});

const advisorToneSchema = z.enum(["formal", "friendly", "analytical"]);

const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  expertise: z.string().min(1).max(2000),
  personality: z.string().min(1).max(2000),
  ensFullName: z.string().min(3).max(200),
  profession: z.string().min(1).max(80).optional(),
  specialization: z.string().min(1).max(200).optional(),
  experience: z.string().min(1).max(500).optional(),
  advisorTone: advisorToneSchema.optional(),
  personalitySliders: sliderSchema.optional(),
  pricing: z
    .object({
      pricePerRequest: z.string().min(1),
      ownerWallet: z.string().refine((w) => isAddress(w), "ownerWallet must be address"),
      currency: z.string().optional(),
    })
    .optional(),
});

const agentRequestSchema = z.object({
  targetEns: z.string().min(3),
  message: z.string().min(1).max(8000),
  fromAgentId: z.string().min(1).max(220).optional(),
});

const transferSchema = z.object({
  tokenId: z.number().int().positive(),
  to: z.string().refine((w) => isAddress(w), "Invalid recipient"),
  fromPrivateKey: z.string().min(10),
});

const delegateSchema = z.object({
  fromAgentENS: z.string().min(3),
  toAgentENS: z.string().min(3),
  message: z.string().min(1).max(8000),
});

const rollbackSchema = z.object({
  version: z.number().int().positive(),
});

const OPENCLAW_TOOLS_CSV =
  "getMemory,saveMemory,fetchENSProfile,fetchAgentConfig,mockWebSearch,readEthBalance";

function hexRoot(r: string): string {
  return r.startsWith("0x") ? r : `0x${r}`;
}

function buildNftTokenUri(metadataRoot: string): string {
  const raw = hexRoot(metadataRoot);
  const t = config.nftTokenUriTemplate.trim();
  if (t) return t.replace(/\{root\}/g, raw).replace(/\{metadataRoot\}/g, raw);
  return `alter-0g-metadata:${raw}`;
}

async function buildVersionsPayload(a: AgentRecord) {
  const history: { version: number; configRoot: string; at: string }[] = [];
  try {
    const created = (await fetchAgentCreatedLogs()).filter((l) => l.tokenId === a.tokenId);
    const first = created[0];
    if (first) history.push({ version: 1, configRoot: hexRoot(first.configRoot), at: a.createdAt });
    const updates = await fetchAgentUpdatedLogs(a.tokenId);
    for (const u of updates) {
      history.push({
        version: u.newVersion,
        configRoot: hexRoot(u.newConfigRoot),
        at: new Date().toISOString(),
      });
    }
  } catch {
    /* ignore */
  }
  let onChain = null as Awaited<ReturnType<typeof readAgentStateOnChain>>;
  try {
    onChain = await readAgentStateOnChain(a.tokenId);
  } catch {
    onChain = null;
  }
  const currentVersion = onChain?.version ?? a.configVersion ?? 1;
  if (!history.length) {
    history.push({ version: currentVersion, configRoot: hexRoot(a.configRoot), at: a.createdAt });
  }
  const dedup = history.filter((v, i, arr) => arr.findIndex((x) => x.version === v.version) === i);
  return { currentVersion, history: dedup };
}

function canMutateTraining(nullifier: string, agent: AgentRecord): boolean {
  const w = getWalletForNullifier(nullifier);
  return Boolean(w && w === agent.owner.toLowerCase());
}

function ragSourcesToLegacySteps(sources: RagSource[]) {
  return sources.map((s, i) => ({
    kind: "reasoning" as const,
    step: i,
    detail: `Fetching training doc: ${s.filename} · ${s.hash.slice(0, 10)}…`,
    shortSummary: `Fetching training doc · ${s.filename}`,
  }));
}

export async function registerRoutes(app: FastifyInstance) {
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

  app.get("/health", async () => ({
    ok: true,
    zg: {
      rpc: config.zgRpc,
      indexerRpc: config.zgIndexerRpc,
      storageKeyConfigured: Boolean(config.zgStoragePrivateKey),
      computeKeyConfigured: Boolean(config.zgComputePrivateKey),
      inferenceProviderPinned: Boolean(config.zgInferenceProvider),
      computeProxyActive: is0GComputeProxyActive(),
      computeProxyModel: is0GComputeProxyActive() ? config.zgComputeProxyModel : null,
    },
  }));

  app.get("/config/public", async () => ({
    publicApiUrl: config.publicApiUrl,
    wldAppId: config.wldAppId,
    wldAction: config.wldAction,
    wldRpId: config.wldRpId,
    zgRpc: config.zgRpc,
    zgIndexerRpc: config.zgIndexerRpc,
    zgChainId: 16602,
    zgExplorerUrl: config.zgExplorerUrl,
    zgStorageScanUrl: config.zgStorageScanUrl,
    inftContractAddress: config.inftAddress || null,
    sepoliaRpcConfigured: Boolean(config.sepoliaRpc),
    discoveryMode: config.discoveryMode,
    paymentMode: config.paymentMode,
    computeProviders: config.computeProviders,
    ensIndexName: config.ensIndexName || null,
    agentIndexRootConfigured: Boolean(config.agentIndexRoot),
    persistAgentsLocally: config.persistAgentsLocally,
    nftTokenUriTemplateConfigured: Boolean(config.nftTokenUriTemplate.trim()),
    strict0gMode: config.strict0gMode,
  }));

  app.get("/auth/world-id/challenge", async (_req, reply) => {
    try {
      assertWorldId();
    } catch (e) {
      return reply.code(503).send({ error: String(e) });
    }
    const rp_context = buildRpContext();
    return {
      action: config.wldAction,
      app_id: config.wldAppId,
      rp_context,
      allow_legacy_proofs: true,
    };
  });

  app.post("/auth/world-id/verify", async (req, reply) => {
    const parsed = verifyBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const result = await verifyWorldProof(parsed.data);
    if (!result.success || !result.nullifier) {
      return reply.code(401).send({ error: result.detail ?? "Verification failed" });
    }
    const token = await app.jwt.sign({ sub: result.nullifier });
    return { token, nullifier: result.nullifier };
  });

  app.post("/session/wallet", { onRequest: [app.authenticate] }, async (req, reply) => {
    const parsed = walletBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { nullifier } = auth(req);
    setWalletForNullifier(nullifier, parsed.data.wallet);
    return { ok: true, wallet: parsed.data.wallet };
  });

  app.get("/session/me", { onRequest: [app.authenticate] }, async (req) => {
    const { nullifier } = auth(req);
    return { nullifier, wallet: getWalletForNullifier(nullifier) ?? null };
  });

  app.post("/agents", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { nullifier } = auth(req);
    const wallet = getWalletForNullifier(nullifier);
    if (!wallet) return reply.code(400).send({ error: "Link a wallet first (POST /session/wallet)" });

    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const {
      name,
      expertise,
      personality,
      ensFullName,
      personalitySliders,
      pricing,
      profession: professionIn,
      specialization: specIn,
      experience: expIn,
      advisorTone: toneIn,
    } = parsed.data;
    const profession = (professionIn ?? "Advisor").trim() || "Advisor";
    const specialization = (specIn ?? "General advisory").trim() || "General advisory";
    const experience = (expIn ?? "Experienced professional").trim() || "Experienced professional";
    const advisorTone = toneIn ?? "friendly";
    const resolved = await resolveEnsAddress(ensFullName);
    if (!resolved || resolved.toLowerCase() !== wallet.toLowerCase()) {
      return reply.code(400).send({
        error:
          "ENS must resolve on Sepolia to your linked wallet. Register the name and set the address record first.",
        checkedName: ensFullName,
        resolved: resolved ?? null,
        expected: wallet,
      });
    }

    const ensKey = ensFullName.toLowerCase();
    const agentId = `ens:${ensKey}`;
    const createdAt = new Date().toISOString();
    const systemPrompt = isWeb3ArchitectProfession(profession)
      ? `${buildWeb3ArchitectSystemPrompt({
          name,
          specialization,
          experience,
          pitch: expertise,
        })}\n\n${ADVISOR_CRITICAL_RULES_FOOTER}`
      : buildAdvisorPrompt({
          name,
          profession,
          specialization,
          experience,
          advisorTone,
          pitch: expertise,
        });
    const openClaw = {
      version: 1 as const,
      enabled: true,
      tools: [
        "getMemory",
        "saveMemory",
        "fetchENSProfile",
        "fetchAgentConfig",
        "mockWebSearch",
        "readEthBalance",
      ],
      maxSteps: 5,
    };
    const configMetaEnvelope = {
      ensFullName: ensKey,
      owner: wallet.toLowerCase(),
      tokenId: 0,
      version: 1,
      ...(isWeb3ArchitectProfession(profession)
        ? {
            web3Architect: {
              version: 1 as const,
              trainingData: getWeb3ArchitectTrainingData(),
              knowledgeBase: getWeb3ArchitectKnowledgeBase(),
            },
          }
        : {}),
    };
    const configPayload = {
      version: 1,
      name,
      ensName: ensKey,
      agentType: "openclaw",
      profession,
      specialization,
      experience,
      advisorTone,
      expertise,
      personality: {
        summary: personality,
        humor: personalitySliders?.humor ?? 55,
        tone: personalitySliders?.tone ?? 50,
        intelligence: personalitySliders?.intelligence ?? 60,
      },
      systemPrompt,
      personalitySliders,
      pricing,
      configVersion: 1,
      openClaw,
      metadata: {
        createdAt,
        creator: wallet.toLowerCase(),
      },
      _alter: configMetaEnvelope,
    };

    let configRoot: string;
    try {
      configRoot = await uploadJsonTo0G(configPayload);
    } catch (e) {
      return reply.code(502).send({ error: `0G Storage failed: ${String(e)}` });
    }

    const nftMetadata = {
      name: `${name} — Alter`,
      description: expertise.slice(0, 280),
      image:
        "https://raw.githubusercontent.com/0gfoundation/0g-storage-ts-starter-kit/master/web/public/logo.png",
      attributes: [
        { trait_type: "ENS", value: ensKey },
        { trait_type: "Profession", value: profession },
        { trait_type: "Specialization", value: specialization.slice(0, 80) },
        { trait_type: "0G Config Root", value: configRoot },
        { trait_type: "Protocol", value: "Alter/OpenClaw/1" },
        { trait_type: "AgentType", value: "openclaw" },
      ],
    };
    let metadataRoot: string;
    try {
      metadataRoot = await uploadJsonTo0G(nftMetadata);
    } catch (e) {
      return reply.code(502).send({ error: `0G NFT metadata upload failed: ${String(e)}` });
    }

    const tokenUri = buildNftTokenUri(metadataRoot);
    let tokenId: number;
    try {
      tokenId = await mintAgentINFT(wallet, tokenUri, configRoot, ensKey, "agent-config-json");
    } catch (e) {
      return reply.code(502).send({ error: `iNFT mint failed: ${String(e)}` });
    }

    let ensWritten = false;
    try {
      ensWritten = await tryWriteEnsTwinRecords(ensFullName, {
        tokenId,
        configRoot,
        ownerWallet: wallet,
        chainId: "16602",
        createdAt,
        version: 1,
        agentType: "openclaw",
        toolsCsv: OPENCLAW_TOOLS_CSV,
        worldIdLinked: true,
      });
    } catch {
      ensWritten = false;
    }

    const agent: AgentRecord = {
      id: agentId,
      tokenId,
      owner: wallet.toLowerCase(),
      ensFullName: ensKey,
      agentType: "openclaw",
      name,
      expertise,
      personality,
      profession,
      specialization,
      experience,
      advisorTone,
      systemPrompt,
      configRoot,
      memoryRoots: [],
      conversationRoots: [],
      reputation: { interactions: 0, successes: 0 },
      createdAt,
      pricing,
      personalitySliders,
      configVersion: 1,
      configHistory: [{ version: 1, configRoot, at: createdAt }],
      longTermRoots: [],
      turnsSinceReflection: 0,
      ensHumanVerifiedHint: ensWritten,
    };
    if (config.persistAgentsLocally) insertAgent(agent);

    let indexManifestRoot: string | undefined;
    try {
      let prevRoot = config.agentIndexRoot.trim();
      if (!prevRoot && config.ensIndexName.trim()) {
        const t = await getEnsAgentTexts(config.ensIndexName.trim());
        prevRoot = t["agent.manifest"] ?? t["twinn.manifest"] ?? "";
      }
      if (prevRoot || config.agentIndexRoot.trim() || config.ensIndexName.trim()) {
        indexManifestRoot = await appendManifestEntry(prevRoot || undefined, {
          id: agentId,
          ensFullName: ensKey,
          owner: wallet.toLowerCase(),
          tokenId,
          configRoot,
          updatedAt: agent.createdAt,
        });
        await tryWriteEnsIndexManifest(indexManifestRoot);
      }
    } catch {
      /* index optional */
    }

    return {
      agent,
      ensMetadataWritten: ensWritten,
      indexManifestRoot,
      deployment: {
        chainId: 16602 as const,
        chainName: "0G Galileo Testnet",
        explorerBaseUrl: config.zgExplorerUrl.replace(/\/$/, ""),
        inftContractAddress: config.inftAddress,
        tokenUri,
        configRoot,
        metadataRoot,
      },
    };
  });

  app.get("/agents", async (req) => {
    const sort = (req.query as { sort?: string }).sort ?? "recent";
    const entries = await listDiscoverableAgents();
    let agents = entries.map((e) => {
      const local = getAgentByEns(e.ensFullName);
      const rep = local?.reputation ?? { interactions: 0, successes: 0 };
      const verifiedHumanTwin = Boolean(local?.ensHumanVerifiedHint && local?.tokenId);
      return {
        id: e.id,
        ensFullName: e.ensFullName,
        name: local?.name ?? e.ensFullName,
        owner: e.owner,
        tokenId: e.tokenId,
        reputation: rep,
        type: "professional-advisor" as const,
        source: e.source ?? "local",
        verifiedHumanTwin,
        openClawAgent: listRowIsOpenClaw(local, e.source ?? "local"),
        rankScore: rep.interactions + rep.successes * 2,
        _updatedAt: e.updatedAt,
        configRoot: e.configRoot,
        memoryHead: local?.ensMemoryHead ?? null,
        personality: local?.personality ?? "",
        expertise: local?.expertise ?? "",
        profession: local?.profession ?? "",
        specialization: local?.specialization ?? "",
        experience: local?.experience ?? "",
        advisorTone: local?.advisorTone ?? "",
        personalitySliders: local?.personalitySliders ?? null,
        pricing: local?.pricing ?? null,
        trainingDocCount: local?.trainingDocCount ?? 0,
      };
    });
    if (sort === "reputation") {
      agents = [...agents].sort((a, b) => b.rankScore - a.rankScore);
    } else if (sort === "usage") {
      agents = [...agents].sort((a, b) => b.reputation.interactions - a.reputation.interactions);
    } else {
      agents = [...agents].sort(
        (a, b) => new Date(b._updatedAt).getTime() - new Date(a._updatedAt).getTime()
      );
    }
    return {
      agents: agents.map(({ rankScore: _, _updatedAt: __, ...rest }) => rest),
    };
  });

  app.get("/agents/by-root/:root", async (req, reply) => {
    const root = decodeURIComponent((req.params as { root: string }).root);
    const a = await resolveAgentByConfigRoot(root);
    if (!a) return reply.code(404).send({ error: "Not found for root" });
    return { agent: publicAgent(a) };
  });

  app.get("/agents/by-ens/:name", async (req, reply) => {
    const name = decodeURIComponent((req.params as { name: string }).name);
    const a = await getAgentResilientByEns(name);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return { agent: publicAgent(a) };
  });

  app.get("/resolve", async (req, reply) => {
    const name = (req.query as { name?: string }).name?.trim().toLowerCase();
    if (!name) return reply.code(400).send({ error: "Query ?name= is required (e.g. agent.eth)" });
    const a = await resolveAgent(name);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return { agent: publicAgent(a) };
  });

  app.get("/verify/:ens", async (req, reply) => {
    const ens = decodeURIComponent((req.params as { ens: string }).ens).toLowerCase();
    const integrity = await verifyAgentIntegrity(ens);
    const texts = await getEnsAgentTexts(ens);
    let tokenUri: string | null = null;
    let chainVersion: number | null = null;
    if (integrity.tokenId !== null && config.inftAddress) {
      try {
        tokenUri = await readTokenURIOnChain(integrity.tokenId);
        const st = await readAgentStateOnChain(integrity.tokenId);
        if (st) chainVersion = st.version;
      } catch {
        /* incomplete env */
      }
    }
    let byteLength = 0;
    let downloadedOk = integrity.configOn0gOk;
    const cfgForProof = effectiveConfigRoot(texts);
    if (cfgForProof && downloadedOk) {
      try {
        const raw = await downloadFrom0G(cfgForProof);
        byteLength = Buffer.byteLength(raw, "utf8");
      } catch {
        downloadedOk = false;
      }
    }
    return {
      ensStandard: "ensip-65-compatible" as const,
      hasAgentRecords: hasAgentNamespaceRecords(texts),
      ensName: integrity.ensName,
      resolvesToWallet: integrity.resolvesToWallet,
      tokenId: integrity.tokenId,
      contractAddress: integrity.contractAddress,
      configRoot: integrity.ensConfigRoot,
      chainConfigRoot: integrity.chainConfigRoot,
      chainVersion,
      tokenURI: tokenUri,
      storageProof: { downloaded: downloadedOk, byteLength },
      memoryHead: integrity.memoryHead,
      memoryAccessible: integrity.memoryAccessible,
      runtime: integrity.runtime,
      tools: integrity.tools,
      isConsistent: integrity.isConsistent,
      isFullyDecentralized: integrity.isFullyDecentralized,
      integrity,
    };
  });

  app.get("/agents/by-ens/:name/versions", async (req, reply) => {
    const name = decodeURIComponent((req.params as { name: string }).name).toLowerCase();
    const a = await getAgentResilientByEns(name);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return buildVersionsPayload(a);
  });

  app.get("/agents/:id/versions", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const a = await getAgentResilientById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return buildVersionsPayload(a);
  });

  app.get("/agents/:id/history", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const a = await getAgentResilientById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return {
      memoryRoots: a.memoryRoots,
      conversationRoots: a.conversationRoots,
      longTermRoots: a.longTermRoots ?? [],
    };
  });

  app.post("/agents/:id/config/rollback", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const parsed = rollbackSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const a = await getAgentResilientById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    const target = (a.configHistory ?? []).find((h) => h.version === parsed.data.version);
    if (!target) return reply.code(400).send({ error: "Version not in history" });
    updateAgent(id, { configRoot: target.configRoot, configVersion: target.version });
    return { ok: true, configRoot: target.configRoot, version: target.version };
  });

  app.get("/agents/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const a = await getAgentResilientById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return { agent: publicAgent(a) };
  });

  app.post("/agents/:id/training", { onRequest: [app.authenticate] }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const a = await getAgentResilientById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    const { nullifier } = auth(req);
    if (!canMutateTraining(nullifier, a)) {
      return reply.code(403).send({ error: "Not authorized" });
    }

    let buffer: Buffer | null = null;
    let uploadFilename = "";
    let mimetype = "";
    let description: string | undefined;

    for await (const part of req.parts()) {
      if (part.type === "file" && part.fieldname === "file") {
        buffer = await part.toBuffer();
        uploadFilename = part.filename || "upload";
        mimetype = part.mimetype || "application/octet-stream";
      } else if (part.type === "field" && part.fieldname === "description") {
        description = String((part as { value?: string }).value ?? "").trim() || undefined;
      }
    }

    if (!buffer) return reply.code(400).send({ error: "No file provided" });

    const allowed = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(mimetype)) {
      return reply.code(400).send({
        error: "File type not supported. Use PDF, TXT, MD, or DOCX.",
      });
    }

    const doc = await uploadTrainingDocument(id, uploadFilename, mimetype, buffer, description);
    const agent2 = (await getAgentResilientById(id)) ?? getAgentById(id);
    if (!agent2) return reply.code(404).send({ error: "Not found" });

    return reply.send({
      doc,
      manifestRoot: agent2.trainingRoot,
      docCount: agent2.trainingDocCount,
    });
  });

  app.get("/agents/:id/training/verify/:docId", async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const result = await verifyTrainingDocumentStorage(id, docId);
    if (!result) return reply.code(404).send({ error: "Doc not found" });

    const { doc, reachable, integrityOk, byteLength, expectedSizeBytes } = result;
    const scan = config.zgStorageScanUrl.replace(/\/$/, "");
    const hashPath = doc.hash.startsWith("0x") ? doc.hash : `0x${doc.hash}`;

    return reply.send({
      doc,
      reachable,
      integrityOk,
      byteLength,
      expectedSizeBytes,
      contentRoot: doc.hash,
      verifiedAt: new Date().toISOString(),
      explorerUrl: `${scan}/submission/${hashPath}`,
      summary: reachable
        ? integrityOk
          ? "Blob downloaded from 0G Storage; byte length matches registry."
          : "Blob reachable on 0G but size mismatch vs registry (re-upload or investigate)."
        : "Blob not retrievable from 0G for this content root.",
    });
  });

  app.get("/agents/:id/training", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const docs = getTrainingDocs(id);
    const manifest = await getTrainingManifest(id);
    const agent = (await getAgentResilientById(id)) ?? getAgentById(id);
    if (!agent) return reply.code(404).send({ error: "Not found" });

    return reply.send({
      docs,
      manifest,
      trainingRoot: agent.trainingRoot,
      docCount: agent.trainingDocCount,
      updatedAt: agent.trainingUpdatedAt,
    });
  });

  app.delete("/agents/:id/training/:docId", { onRequest: [app.authenticate] }, async (req, reply) => {
    const { id, docId } = req.params as { id: string; docId: string };
    const a = await getAgentResilientById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    const { nullifier } = auth(req);
    if (!canMutateTraining(nullifier, a)) {
      return reply.code(403).send({ error: "Not authorized" });
    }

    await deleteTrainingDocument(id, docId);
    const updated = (await getAgentResilientById(id)) ?? getAgentById(id);
    if (!updated) return reply.code(404).send({ error: "Not found" });

    return reply.send({
      success: true,
      manifestRoot: updated.trainingRoot,
      docCount: updated.trainingDocCount,
    });
  });

  app.get("/nft/metadata/:agentId", async (req, reply) => {
    const agentId = (req.params as { agentId: string }).agentId;
    const a = (await getAgentResilientById(agentId)) ?? getAgentById(agentId);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return {
      name: `${a.name} — Alter`,
      description: a.expertise.slice(0, 280),
      image: "https://raw.githubusercontent.com/0gfoundation/0g-storage-ts-starter-kit/master/web/public/logo.png",
      attributes: [
        { trait_type: "ENS", value: a.ensFullName },
        ...(a.profession ? [{ trait_type: "Profession", value: a.profession }] : []),
        ...(a.specialization ? [{ trait_type: "Specialization", value: a.specialization.slice(0, 80) }] : []),
        { trait_type: "Token ID", value: String(a.tokenId) },
        { trait_type: "0G Config Root", value: a.configRoot },
        { trait_type: "Config Version", value: String(a.configVersion ?? 1) },
        ...(agentRecordIsOpenClaw(a) ? [{ trait_type: "Runtime", value: "OpenClaw" }] : []),
      ],
    };
  });

  app.post("/agent/request", async (req, reply) => {
    const parsed = agentRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { targetEns, message, fromAgentId } = parsed.data;
    const normalized = targetEns.toLowerCase();
    const meta = await getEnsAgentMeta(normalized);

    let target = await getAgentResilientByEns(normalized);
    if (!target && meta.configRoot) target = await resolveAgentByConfigRoot(meta.configRoot);
    if (!target && meta.tokenId) {
      let st: Awaited<ReturnType<typeof readAgentStateOnChain>> = null;
      try {
        st = await readAgentStateOnChain(Number(meta.tokenId));
      } catch {
        st = null;
      }
      if (st?.ensName) target = await getAgentResilientByEns(st.ensName.toLowerCase());
    }
    if (!target && meta.agentId) {
      target = (await getAgentResilientById(meta.agentId)) ?? getAgentById(meta.agentId) ?? null;
    }
    if (!target) {
      return reply.code(404).send({ error: "Target agent not found for ENS (registry or text records)" });
    }

    ensureAgentCacheForMutation(target);

    let caller: AgentRecord | null = null;
    if (fromAgentId) {
      caller = (await getAgentResilientById(fromAgentId)) ?? getAgentById(fromAgentId) ?? null;
      if (!caller) return reply.code(404).send({ error: "fromAgentId not found" });
    }

    try {
      await assertPaymentOrContinue(target);
    } catch (e) {
      return reply.code(402).send({ error: String(e) });
    }

    const { headRoot: memoryRootBefore } = await loadLatestClawMemory(target);

    let replyText: string;
    let inferenceProvider: string;
    let executionLog:
      | { mode: string; steps: unknown[]; toolsUsed: unknown[]; ragSources?: RagSource[] }
      | undefined;
    let ragSourcesOut: RagSource[] = [];
    let tall: Awaited<ReturnType<typeof runUnifiedAgentTurn>>;
    try {
      tall = await runUnifiedAgentTurn(target, message, caller);
      ragSourcesOut = tall.ragSources ?? [];
      if (tall.mode === "openclaw") {
        replyText = tall.reply;
        inferenceProvider = tall.provider;
        executionLog = {
          mode: "openclaw",
          steps: tall.steps,
          toolsUsed: tall.toolsUsed,
          ragSources: ragSourcesOut,
        };
      } else {
        replyText = tall.reply;
        inferenceProvider = tall.provider;
        executionLog =
          ragSourcesOut.length > 0
            ? {
                mode: "legacy",
                steps: ragSourcesToLegacySteps(ragSourcesOut),
                toolsUsed: [],
                ragSources: ragSourcesOut,
              }
            : undefined;
      }
      replyText = cleanResponse(replyText);
    } catch (e) {
      const t2 = getAgentById(target.id) ?? target;
      updateAgent(t2.id, {
        reputation: {
          interactions: t2.reputation.interactions + 1,
          successes: t2.reputation.successes,
        },
      });
      return reply.code(502).send({ error: `0G Compute inference failed: ${String(e)}` });
    }

    const att = buildProofHash(message, replyText, target.configRoot);
    let attestationRoot: string | undefined;
    try {
      attestationRoot = await persistAttestation(att);
    } catch {
      /* optional */
    }

    let memRoot: string;
    try {
      if (tall.mode === "openclaw") {
        const { doc: priorDoc, headRoot } = await loadLatestClawMemory(target);
        const merged = mergeClawMemoryForTurn(target, priorDoc, headRoot, tall);
        const turnMeta = {
          ts: new Date().toISOString(),
          target: target.ensFullName,
          from: caller?.ensFullName ?? "external",
          message,
          reply: replyText,
          proofHash: att.combinedHash,
          inferenceProvider,
          attestationRoot,
        };
        memRoot = await uploadJsonTo0G({ ...merged, lastTurn: turnMeta });
      } else {
        const turn = {
          ts: new Date().toISOString(),
          target: target.ensFullName,
          from: caller?.ensFullName ?? "external",
          message,
          reply: replyText,
          proofHash: att.combinedHash,
          inferenceProvider,
          attestationRoot,
        };
        memRoot = await persistMemorySnippet(target, turn);
      }
    } catch (e) {
      return reply.code(502).send({ error: `0G Storage (memory) failed: ${String(e)}` });
    }

    const tlocal = getAgentById(target.id) ?? target;
    const nextConv = [...tlocal.conversationRoots, memRoot];
    let ensMemoryHeadUpdated = false;
    if (tall.mode === "openclaw") {
      try {
        ensMemoryHeadUpdated = await updateEnsMemoryHead(target.ensFullName, memRoot);
      } catch {
        ensMemoryHeadUpdated = false;
      }
    }
    updateAgent(tlocal.id, {
      conversationRoots: nextConv,
      ensMemoryHead: tall.mode === "openclaw" ? memRoot : tlocal.ensMemoryHead,
      reputation: {
        interactions: tlocal.reputation.interactions + 1,
        successes: tlocal.reputation.successes + 1,
      },
    });
    bumpReflectionCounter(tlocal.id);

    try {
      await appendIntelligentDataOnChain(tlocal.tokenId, att.combinedHash, "counselr-proof");
    } catch {
      /* optional */
    }

    let reflectionTriggered = false;
    try {
      reflectionTriggered = await maybeRunReflection(tlocal.id);
    } catch {
      /* reflection best-effort */
    }

    return {
      reply: replyText,
      proofHash: att.combinedHash,
      memoryRoot: memRoot,
      memoryRootBefore: memoryRootBefore ?? null,
      memoryRootAfter: memRoot,
      ensMemoryHeadUpdated,
      reflectionTriggered,
      agentId: tlocal.id,
      inferenceProvider,
      attestationRoot,
      executionLog: executionLog ?? null,
      openClaw: tall.mode === "openclaw",
      ragSources: ragSourcesOut,
    };
  });

  app.post("/agent/delegate", async (req, reply) => {
    const parsed = delegateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { fromAgentENS, toAgentENS, message } = parsed.data;
    const fromA = await getAgentResilientByEns(fromAgentENS.toLowerCase());
    const toA = await getAgentResilientByEns(toAgentENS.toLowerCase());
    if (!fromA) return reply.code(404).send({ error: "fromAgentENS not found" });
    if (!toA) return reply.code(404).send({ error: "toAgentENS not found" });

    try {
      await assertPaymentOrContinue(toA);
      await assertPaymentOrContinue(fromA);
    } catch (e) {
      return reply.code(402).send({ error: String(e) });
    }

    let hopPeer: string;
    let hopFinal: string;
    let provider: string;
    let delegateExecution: { steps: unknown[]; toolsUsed: unknown[] } | null = null;
    const conversation: { from: "A" | "B"; message: string }[] = [];
    try {
      const r1 = await runUnifiedAgentTurn(
        fromA,
        `Operator delegate request to ${toA.ensFullName}: ${message}\nUse invokePeerAgent with targetEns "${toA.ensFullName}" when you need their view, then produce one coordinated answer.`,
        null,
        { delegatePeer: toA }
      );
      hopFinal = cleanResponse(r1.reply);
      provider = r1.provider;
      conversation.push({
        from: "A",
        message: `Coordinating with ${toA.ensFullName}: ${message}`,
      });
      if (r1.mode === "openclaw") {
        delegateExecution = { steps: r1.steps, toolsUsed: r1.toolsUsed };
        const peerCalls = r1.toolsUsed.filter((t) => t.name === "invokePeerAgent");
        for (const t of peerCalls) {
          const q = typeof t.arguments.message === "string" ? t.arguments.message : "";
          conversation.push({ from: "B", message: q ? `[in] ${q}\n[out] ${t.result}` : t.result });
        }
        const peerHit = peerCalls.length ? peerCalls[peerCalls.length - 1] : undefined;
        hopPeer = peerHit?.result ?? "(peer not invoked — model answered directly)";
      } else {
        hopPeer = "(legacy mode — no OpenClaw tool trace)";
      }
      conversation.push({ from: "A", message: hopFinal });
    } catch (e) {
      return reply.code(502).send({ error: `Delegate inference failed: ${String(e)}` });
    }

    const att = buildProofHash(`${message}|${hopPeer}`, hopFinal, `${fromA.configRoot}|${toA.configRoot}`);
    const delegateLog = {
      ts: new Date().toISOString(),
      type: "delegate/openclaw/v1",
      from: fromA.ensFullName,
      to: toA.ensFullName,
      message,
      peerObservation: hopPeer,
      finalReply: hopFinal,
      proofHash: att.combinedHash,
    };
    let logRoot: string;
    try {
      logRoot = await persistMemorySnippet(toA, delegateLog);
    } catch (e) {
      return reply.code(502).send({ error: `0G Storage (delegate log) failed: ${String(e)}` });
    }
    const tlocal = getAgentById(toA.id) ?? toA;
    if (getAgentById(tlocal.id)) {
      updateAgent(tlocal.id, {
        conversationRoots: [...tlocal.conversationRoots, logRoot],
      });
    }

    return {
      reply: hopFinal,
      peerObservation: hopPeer,
      proofHash: att.combinedHash,
      memoryRoot: logRoot,
      inferenceProvider: provider,
      agentA: { id: fromA.id, ensFullName: fromA.ensFullName },
      agentB: { id: toA.id, ensFullName: toA.ensFullName },
      conversation,
      executionLog: delegateExecution,
      delegateExecution,
    };
  });

  app.post("/agents/transfer", async (req, reply) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { tokenId, to, fromPrivateKey } = parsed.data;
    const a = getDb().agents.find((x) => x.tokenId === tokenId);
    const st = await readAgentStateOnChain(tokenId).catch(() => null);
    if (!a && !st) return reply.code(404).send({ error: "Unknown tokenId (not on chain)" });
    try {
      const { transferINFT } = await import("./inft.js");
      await transferINFT(fromPrivateKey, to, tokenId);
      if (a) updateAgent(a.id, { owner: to.toLowerCase() });
      return { ok: true };
    } catch (e) {
      return reply.code(502).send({ error: String(e) });
    }
  });
}

const DEFAULT_OPENCLAW_TOOLS = [
  "getMemory",
  "saveMemory",
  "fetchENSProfile",
  "fetchAgentConfig",
  "mockWebSearch",
  "readEthBalance",
] as const;

function publicAgent(a: AgentRecord) {
  const openClawAgent = agentRecordIsOpenClaw(a);
  return {
    id: a.id,
    ensFullName: a.ensFullName,
    name: a.name,
    expertise: a.expertise,
    personality: a.personality,
    profession: a.profession ?? null,
    specialization: a.specialization ?? null,
    experience: a.experience ?? null,
    advisorTone: a.advisorTone ?? null,
    systemPrompt: a.systemPrompt ?? null,
    owner: a.owner,
    tokenId: a.tokenId,
    configRoot: a.configRoot,
    configVersion: a.configVersion ?? 1,
    reputation: a.reputation,
    createdAt: a.createdAt,
    type: "professional-advisor",
    pricing: a.pricing ?? null,
    personalitySliders: a.personalitySliders ?? null,
    verifiedHumanTwin: Boolean(a.ensHumanVerifiedHint && a.tokenId > 0),
    agentType: a.agentType ?? null,
    openClawAgent,
    toolsEnabled: openClawAgent ? [...DEFAULT_OPENCLAW_TOOLS] : [],
    memoryHead: a.ensMemoryHead ?? null,
    trainingRoot: a.trainingRoot ?? null,
    trainingDocCount: a.trainingDocCount ?? 0,
    trainingUpdatedAt: a.trainingUpdatedAt ?? null,
  };
}
