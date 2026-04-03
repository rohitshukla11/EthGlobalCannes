import { createRequire } from "node:module";
import { Wallet, JsonRpcProvider } from "ethers";
import { assertProduction0G, config } from "./config.js";

const require = createRequire(import.meta.url);
const {
  createZGComputeNetworkBroker,
  createZGComputeNetworkReadOnlyBroker,
}: typeof import("@0glabs/0g-serving-broker") = require("@0glabs/0g-serving-broker");

let broker: Awaited<ReturnType<typeof createZGComputeNetworkBroker>> | null = null;
/** Cached when `ZG_INFERENCE_PROVIDER` is unset so we do not call listService on every turn. */
let cachedAutoPickedProvider: string | null = null;

async function getBroker() {
  assertProduction0G();
  if (!broker) {
    const provider = new JsonRpcProvider(config.zgRpc);
    const wallet = new Wallet(config.zgComputePrivateKey, provider);
    broker = await createZGComputeNetworkBroker(wallet as never);
  }
  return broker;
}

async function pickProvider(): Promise<string> {
  if (config.zgInferenceProvider) return config.zgInferenceProvider;
  if (cachedAutoPickedProvider) return cachedAutoPickedProvider;
  const ro = await createZGComputeNetworkReadOnlyBroker(config.zgRpc);
  const list = await ro.inference.listService();
  if (!list.length) throw new Error("No 0G Compute providers available on this network");
  cachedAutoPickedProvider = list[0]!.provider;
  return cachedAutoPickedProvider;
}

/**
 * Chat completion via 0G Compute (OpenAI-compatible proxy). No local model execution.
 */
export async function infer0GChat(messages: { role: string; content: string }[]): Promise<string> {
  const b = await getBroker();
  const providerAddr = await pickProvider();
  try {
    await b.inference.acknowledgeProviderSigner(providerAddr);
  } catch {
    /* already acknowledged */
  }
  const { endpoint, model } = await b.inference.getServiceMetadata(providerAddr);
  const headers = await b.inference.getRequestHeaders(providerAddr);
  const url = `${endpoint}/chat/completions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`0G Compute HTTP ${res.status}: ${t}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("0G Compute: empty completion");
  return content;
}
