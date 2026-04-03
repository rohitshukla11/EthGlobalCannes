import { signRequest } from "@worldcoin/idkit-core";
import { config, assertWorldId } from "./config.js";

export function buildRpContext() {
  assertWorldId();
  const sig = signRequest(config.wldAction, config.wldSigningKeyHex, 300);
  return {
    rp_id: config.wldRpId,
    nonce: sig.nonce,
    created_at: sig.createdAt,
    expires_at: sig.expiresAt,
    signature: sig.sig,
  };
}

export async function verifyWorldProof(body: unknown): Promise<{ success: boolean; nullifier?: string; detail?: string }> {
  assertWorldId();
  const res = await fetch(`https://developer.worldcoin.org/api/v4/verify/${config.wldRpId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { success?: boolean; nullifier?: string; detail?: string; code?: string };
  if (!res.ok || !data.success) {
    return { success: false, detail: data.detail ?? data.code ?? `HTTP ${res.status}` };
  }
  return { success: true, nullifier: data.nullifier };
}
