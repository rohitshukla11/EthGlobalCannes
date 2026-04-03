import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { isAddress } from "viem";
import { buildRpContext, verifyWorldProof } from "./worldId.js";
import { config, assertWorldId } from "./config.js";
import {
  getDb,
  getAgentByEns,
  getAgentById,
  insertAgent,
  listAgents,
  newAgentId,
  setWalletForNullifier,
  getWalletForNullifier,
  updateAgent,
} from "./db.js";
import { uploadJsonTo0G } from "./storage0g.js";
import { mintAgentINFT, appendIntelligentDataOnChain } from "./inft.js";
import { tryWriteEnsTwinRecords, resolveEnsAddress, getEnsAgentMeta } from "./ens.js";
import { runAgentTurn, persistMemorySnippet } from "./agentLogic.js";
import type { AgentRecord } from "./types.js";

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

const createAgentSchema = z.object({
  name: z.string().min(1).max(120),
  expertise: z.string().min(1).max(2000),
  personality: z.string().min(1).max(2000),
  ensFullName: z.string().min(3).max(200),
});

const agentRequestSchema = z.object({
  targetEns: z.string().min(3),
  message: z.string().min(1).max(8000),
  fromAgentId: z.string().uuid().optional(),
});

const transferSchema = z.object({
  tokenId: z.number().int().positive(),
  to: z.string().refine((w) => isAddress(w), "Invalid recipient"),
  fromPrivateKey: z.string().min(10),
});

export async function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({
    ok: true,
    zg: {
      rpc: config.zgRpc,
      indexerRpc: config.zgIndexerRpc,
      storageKeyConfigured: Boolean(config.zgStoragePrivateKey),
      computeKeyConfigured: Boolean(config.zgComputePrivateKey),
      inferenceProviderPinned: Boolean(config.zgInferenceProvider),
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
    inftContractAddress: config.inftAddress || null,
    sepoliaRpcConfigured: Boolean(config.sepoliaRpc),
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

    const { name, expertise, personality, ensFullName } = parsed.data;
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

    const id = newAgentId();
    const configPayload = { name, expertise, personality };
    let configRoot: string;
    try {
      configRoot = await uploadJsonTo0G(configPayload);
    } catch (e) {
      return reply.code(502).send({ error: `0G Storage failed: ${String(e)}` });
    }

    const tokenUri = `${config.publicApiUrl}/nft/metadata/${id}`;
    let tokenId: number;
    try {
      tokenId = await mintAgentINFT(wallet, tokenUri, configRoot, "agent-config-json");
    } catch (e) {
      return reply.code(502).send({ error: `iNFT mint failed: ${String(e)}` });
    }

    let ensWritten = false;
    try {
      ensWritten = await tryWriteEnsTwinRecords(ensFullName, id, tokenId);
    } catch {
      ensWritten = false;
    }

    const agent: AgentRecord = {
      id,
      tokenId,
      owner: wallet,
      ensFullName: ensFullName.toLowerCase(),
      name,
      expertise,
      personality,
      configRoot,
      memoryRoots: [],
      conversationRoots: [],
      reputation: { interactions: 0, successes: 0 },
      createdAt: new Date().toISOString(),
    };
    insertAgent(agent);

    return {
      agent,
      ensMetadataWritten: ensWritten,
      deployment: {
        chainId: 16602 as const,
        chainName: "0G Galileo Testnet",
        explorerBaseUrl: config.zgExplorerUrl.replace(/\/$/, ""),
        inftContractAddress: config.inftAddress,
        tokenUri,
        /** Agent JSON on 0G Storage (Merkle root). */
        configRoot,
      },
    };
  });

  app.get("/agents", async () => {
    const agents = listAgents();
    return {
      agents: agents.map((a) => ({
        id: a.id,
        ensFullName: a.ensFullName,
        name: a.name,
        owner: a.owner,
        tokenId: a.tokenId,
        reputation: a.reputation,
        type: "digital-twin",
      })),
    };
  });

  app.get("/agents/by-ens/:name", async (req, reply) => {
    const name = decodeURIComponent((req.params as { name: string }).name);
    const a = getAgentByEns(name);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return { agent: publicAgent(a) };
  });

  app.get("/agents/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const a = getAgentById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return { agent: publicAgent(a) };
  });

  app.get("/agents/:id/history", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const a = getAgentById(id);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return {
      memoryRoots: a.memoryRoots,
      conversationRoots: a.conversationRoots,
    };
  });

  app.get("/nft/metadata/:agentId", async (req, reply) => {
    const agentId = (req.params as { agentId: string }).agentId;
    const a = getAgentById(agentId);
    if (!a) return reply.code(404).send({ error: "Not found" });
    return {
      name: `${a.name} — TwinNet`,
      description: a.expertise.slice(0, 280),
      image: "https://raw.githubusercontent.com/0gfoundation/0g-storage-ts-starter-kit/master/web/public/logo.png",
      attributes: [
        { trait_type: "ENS", value: a.ensFullName },
        { trait_type: "Token ID", value: String(a.tokenId) },
        { trait_type: "0G Config Root", value: a.configRoot },
      ],
    };
  });

  app.post("/agent/request", async (req, reply) => {
    const parsed = agentRequestSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { targetEns, message, fromAgentId } = parsed.data;
    const normalized = targetEns.toLowerCase();

    let target = getAgentByEns(normalized);
    if (!target) {
      const meta = await getEnsAgentMeta(normalized);
      if (meta.agentId) target = getAgentById(meta.agentId);
    }
    if (!target) {
      return reply.code(404).send({ error: "Target agent not found for ENS (registry or text records)" });
    }

    const caller = fromAgentId ? getAgentById(fromAgentId) : null;
    if (fromAgentId && !caller) return reply.code(404).send({ error: "fromAgentId not found" });

    let replyText: string;
    try {
      replyText = await runAgentTurn(target, message, caller);
    } catch (e) {
      updateAgent(target.id, {
        reputation: {
          interactions: target.reputation.interactions + 1,
          successes: target.reputation.successes,
        },
      });
      return reply.code(502).send({ error: `0G Compute inference failed: ${String(e)}` });
    }

    const turn = {
      ts: new Date().toISOString(),
      target: target.ensFullName,
      from: caller?.ensFullName ?? "external",
      message,
      reply: replyText,
    };

    let memRoot: string;
    try {
      memRoot = await persistMemorySnippet(target, turn);
    } catch (e) {
      return reply.code(502).send({ error: `0G Storage (memory) failed: ${String(e)}` });
    }

    const nextConv = [...target.conversationRoots, memRoot];
    updateAgent(target.id, {
      conversationRoots: nextConv,
      reputation: {
        interactions: target.reputation.interactions + 1,
        successes: target.reputation.successes + 1,
      },
    });

    try {
      await appendIntelligentDataOnChain(target.tokenId, memRoot, "conversation-turn");
    } catch {
      /* on-chain append optional if gas or owner misconfigured */
    }

    return { reply: replyText, memoryRoot: memRoot, agentId: target.id };
  });

  app.post("/agents/transfer", async (req, reply) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { tokenId, to, fromPrivateKey } = parsed.data;
    const a = getDb().agents.find((x) => x.tokenId === tokenId);
    if (!a) return reply.code(404).send({ error: "Agent not in registry" });
    try {
      const { transferINFT } = await import("./inft.js");
      await transferINFT(fromPrivateKey, to, tokenId);
      updateAgent(a.id, { owner: to.toLowerCase() });
      return { ok: true };
    } catch (e) {
      return reply.code(502).send({ error: String(e) });
    }
  });
}

function publicAgent(a: AgentRecord) {
  return {
    id: a.id,
    ensFullName: a.ensFullName,
    name: a.name,
    expertise: a.expertise,
    personality: a.personality,
    owner: a.owner,
    tokenId: a.tokenId,
    configRoot: a.configRoot,
    reputation: a.reputation,
    createdAt: a.createdAt,
    type: "digital-twin",
  };
}
