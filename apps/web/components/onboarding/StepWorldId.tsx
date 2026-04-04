"use client";

import { useCallback, useEffect, useState } from "react";
import { IDKitRequestWidget, deviceLegacy } from "@worldcoin/idkit";
import { AnimatePresence, motion } from "framer-motion";
import { Shield } from "lucide-react";
import { apiPost, apiBase } from "@/lib/api";
import { decodeJwtSub, truncateMiddle } from "@/lib/jwt";
import { getStoredToken, setStoredToken, getVerifiedAt, setVerifiedAt } from "@/lib/session";
import { DeviceVerifyVisual } from "@/components/onboarding/DeviceVerifyVisual";
import { ParticleNetwork } from "@/components/onboarding/ParticleNetwork";
import { useCommandLog } from "@/components/command-log/CommandLogProvider";

type Challenge = {
  action: string;
  app_id: string;
  rp_context: {
    rp_id: string;
    nonce: string;
    created_at: number;
    expires_at: number;
    signature: string;
  };
  allow_legacy_proofs: boolean;
};

type Props = {
  onVerified: () => void;
};

export function StepWorldId({ onVerified }: Props) {
  const { push } = useCommandLog();
  const [open, setOpen] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loadingChallenge, setLoadingChallenge] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [verifiedAt, setVerifiedAtState] = useState<string | null>(null);

  useEffect(() => {
    const t = getStoredToken();
    const at = getVerifiedAt();
    setToken(t);
    setVerifiedAtState(at);
  }, []);

  const verified = Boolean(token);
  const pending = loadingChallenge || open || verifying;
  const sub = decodeJwtSub(token);

  const loadChallenge = useCallback(async () => {
    setErr(null);
    setLoadingChallenge(true);
    try {
      const r = await fetch(`${apiBase}/auth/world-id/challenge`);
      if (!r.ok) throw new Error(await r.text());
      setChallenge((await r.json()) as Challenge);
      setOpen(true);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoadingChallenge(false);
    }
  }, []);

  return (
    <div className="relative z-10 flex min-h-full flex-1 items-center justify-center">
      <ParticleNetwork />
      <div className="relative z-10 flex flex-col items-center gap-16 md:flex-row md:gap-20">
        <DeviceVerifyVisual verified={verified} pending={pending} />
        <div className="max-w-[360px]">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">01 — IDENTITY</p>
          <h2 className="mt-3 font-display text-[40px] font-extrabold leading-none text-primary">Verify humanity</h2>
          <p className="mt-5 max-w-[320px] font-mono text-[13px] leading-[1.8] text-secondary">
            Only verified humans can publish an advisor on Counselr. World ID — one ZK proof per person; no raw biometrics
            stored by us.
          </p>
          <div className="mt-8">
            {!verified ? (
              <motion.button
                type="button"
                disabled={loadingChallenge}
                onClick={() => loadChallenge().catch(() => {})}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex h-11 items-center gap-2 rounded-control bg-accent px-7 font-mono text-[12px] font-medium tracking-[0.08em] text-void transition-colors hover:bg-[#F0FF70] disabled:opacity-50"
                aria-label="Verify with World ID"
              >
                {pending ? (
                  <>
                    <svg
                      className="spinner-700 size-3.5 text-void"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeDasharray="31 40"
                        strokeLinecap="round"
                      />
                    </svg>
                    <span>VERIFYING</span>
                  </>
                ) : (
                  <>
                    <Shield className="size-4 stroke-[2] text-void" aria-hidden />
                    <span>VERIFY</span>
                  </>
                )}
              </motion.button>
            ) : null}
            {err ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-2 font-mono text-[13px] text-error">
                <span className="size-2 shrink-0 rounded-full bg-error" aria-hidden />
                <span>{err.includes("fetch") ? "Failed to fetch — check your network" : err}</span>
                <button
                  type="button"
                  className="text-secondary underline decoration-mid underline-offset-2 hover:text-primary"
                  onClick={() => loadChallenge().catch(() => {})}
                >
                  Retry
                </button>
                <a
                  href="https://docs.world.org/world-id"
                  target="_blank"
                  rel="noreferrer"
                  className="text-secondary underline decoration-mid underline-offset-2 hover:text-primary"
                >
                  Docs ↗
                </a>
              </p>
            ) : null}
          </div>
          <AnimatePresence>
            {verified && sub ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="mt-6 rounded-control border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.04)] px-4 py-3 font-mono text-[12px]"
              >
                <p className="flex items-center gap-2 text-success">
                  <span className="size-2 rounded-full bg-success" aria-hidden />
                  Human verified
                </p>
                <p className="mt-2 text-tertiary">
                  Anonymous ID: {truncateMiddle(sub, 6, 4)}
                </p>
                <p className="mt-2 max-w-[320px] text-[11px] leading-relaxed text-tertiary/90">
                  A stable, private handle from your proof—one per person for this step, not your name or wallet. Counselr keeps it only in your session token.
                </p>
                {verifiedAt ? (
                  <p className="mt-1 text-tertiary">
                    timestamp: {new Date(verifiedAt).toISOString().replace("T", " ").slice(0, 16)} UTC
                  </p>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {challenge ? (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setVerifying(false);
          }}
          app_id={challenge.app_id as `app_${string}`}
          action={challenge.action}
          rp_context={challenge.rp_context}
          allow_legacy_proofs={challenge.allow_legacy_proofs}
          preset={deviceLegacy()}
          onSuccess={async (result) => {
            setVerifying(true);
            try {
              const { token: t } = await apiPost<{ token: string }>("/auth/world-id/verify", result);
              setStoredToken(t);
              const now = new Date().toISOString();
              setVerifiedAt(now);
              setToken(t);
              setVerifiedAtState(now);
              setOpen(false);
              setErr(null);
              push({ level: "success", event: "WORLD_ID", value: "proof generated" });
              onVerified();
            } catch (e) {
              setErr(String(e));
            } finally {
              setVerifying(false);
            }
          }}
          onError={(c) => {
            setErr(String(c));
            setVerifying(false);
          }}
        />
      ) : null}
    </div>
  );
}
