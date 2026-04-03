"use client";

import { useMemo, useState } from "react";
import { sleep } from "@/lib/sleep";
import { AnimatePresence, motion } from "framer-motion";
import { getStoredToken } from "@/lib/session";
import { apiPost } from "@/lib/api";
import { DeploymentProofsPanel } from "@/components/deployment/DeploymentProofsPanel";
import { useAccount } from "wagmi";
import { useCommandLog } from "@/components/command-log/CommandLogProvider";

const ARCHETYPES = [
  { id: "ANALYTICAL", name: "ANALYTICAL", desc: "Precise, data-driven, finds patterns in chaos" },
  { id: "CURIOUS", name: "CURIOUS", desc: "Always asking why. Every talk becomes discovery" },
  { id: "WARM", name: "WARM", desc: "Remembers what matters. Genuinely present" },
  { id: "WITTY", name: "WITTY", desc: "Sharp, dry. Makes the serious feel light" },
  { id: "STRATEGIC", name: "STRATEGIC", desc: "Thinks three moves ahead. Plays the long game" },
  { id: "CREATIVE", name: "CREATIVE", desc: "Lateral thinking. Unexpected angles always" },
] as const;

function glyphFor(count: number): string {
  if (count === 0) return "◇";
  if (count <= 2) return "◈";
  if (count <= 4) return "❋";
  return "✦";
}

function slugName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

/** If the field already looks like an ENS name, use it; otherwise default to `{slug}.persona.eth`. */
function buildEnsFullName(agentNameField: string): string {
  const t = agentNameField.trim();
  if (/\.eth$/i.test(t)) return t;
  return `${slugName(t)}.persona.eth`;
}

type CreateAgentResponse = {
  agent: {
    id: string;
    tokenId: number;
    owner: string;
    ensFullName: string;
    name: string;
    configRoot: string;
  };
  ensMetadataWritten: boolean;
  deployment: {
    chainId: number;
    chainName: string;
    explorerBaseUrl: string;
    inftContractAddress: string;
    tokenUri: string;
    configRoot: string;
    metadataRoot: string;
  };
};

type Props = {
  onMinted?: () => void;
};

export function StepCreate({ onMinted }: Props) {
  const { push } = useCommandLog();
  const { address } = useAccount();
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [name, setName] = useState("");
  const [minting, setMinting] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [success, setSuccess] = useState(false);
  const [mintReceipt, setMintReceipt] = useState<CreateAgentResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [humor, setHumor] = useState(55);
  const [tone, setTone] = useState(50);
  const [intelligence, setIntelligence] = useState(60);

  const count = selected.size;
  const glyph = useMemo(() => glyphFor(count), [count]);
  const ensPreview = useMemo(() => buildEnsFullName(name), [name]);
  const canMint = name.trim().length > 0 && count >= 1;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runMint() {
    const t = getStoredToken();
    if (!t || !address) {
      setErr("Session or wallet missing");
      return;
    }
    if (!name.trim()) {
      setErr("Invalid name");
      return;
    }
    const ensFullName = buildEnsFullName(name);
    if (!ensFullName || ensFullName === ".persona.eth") {
      setErr("Invalid name");
      return;
    }
    const personality = `Archetypes: ${[...selected].join(", ")}.`;
    const expertise = "Digital twin agent shaped in TwinNet onboarding.";

    setErr(null);
    setMinting(true);
    setSuccess(false);
    setMintReceipt(null);

    const phases: { label: string; ms: number }[] = [
      { label: "SIGNING...", ms: 500 },
      { label: "WRITING TO 0G STORAGE...", ms: 1000 },
      { label: "MINTING iNFT...", ms: 1200 },
      { label: "UPDATING ENS...", ms: 800 },
    ];

    try {
      push({ level: "pending", event: "STORAGE", value: "writing memory..." });
      const fetchPromise = apiPost<CreateAgentResponse>(
        "/agents",
        {
          name: name.trim(),
          expertise,
          personality,
          ensFullName,
          personalitySliders: { humor, tone, intelligence },
          pricing:
            address ?
              {
                pricePerRequest: "0",
                ownerWallet: address,
                currency: "mock-wei",
              }
            : undefined,
        },
        t
      );
      for (const p of phases) {
        setPhaseLabel(p.label);
        await sleep(p.ms);
      }
      const res = await fetchPromise;
      push({ level: "success", event: "CHAIN", value: `minting #${String(res.agent.tokenId).padStart(4, "0")}` });
      push({ level: "success", event: "ENS", value: res.agent.ensFullName });
      setMintReceipt(res);
      setSuccess(true);
      onMinted?.();
    } catch (e) {
      setErr(String(e));
      push({ level: "error", event: "CHAIN", value: "mint failed" });
    } finally {
      setMinting(false);
      setPhaseLabel("");
    }
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[700px] flex-col py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">03 — CREATE</p>
      <h2 className="mt-3 font-display text-[36px] font-extrabold leading-none text-primary">Shape your Persona</h2>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ARCHETYPES.map((a) => {
          const on = selected.has(a.id);
          return (
            <motion.button
              key={a.id}
              type="button"
              onClick={() => toggle(a.id)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              animate={{
                borderColor: on ? "rgba(232,255,90,0.4)" : "rgba(255,255,255,0.06)",
              }}
              transition={{ duration: 0.15 }}
              className={`tile-glow relative rounded-ui border p-5 text-left ${on ? "tile-glow-selected" : ""}`}
            >
              <p className={`font-mono text-[12px] font-medium ${on ? "text-accent" : "text-primary"}`}>{a.name}</p>
              <p className="mt-2 font-mono text-[11px] font-light leading-relaxed text-tertiary">{a.desc}</p>
            </motion.button>
          );
        })}
      </div>

      <div className="mt-10 space-y-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Personality controls</p>
        {(
          [
            ["Humor", humor, setHumor],
            ["Tone", tone, setTone],
            ["Intelligence", intelligence, setIntelligence],
          ] as const
        ).map(([label, val, set]) => (
          <label key={label} className="block">
            <span className="mb-1 flex justify-between font-mono text-[11px] text-secondary">
              <span>{label}</span>
              <span className="text-accent">{val}</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={val}
              onChange={(e) => set(Number(e.target.value))}
              className="w-full accent-accent"
            />
          </label>
        ))}
      </div>

      <label className="mt-12 block">
        <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Agent name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="aria or yourname.eth"
          className="w-full border-0 border-b border-dim bg-transparent py-2 font-mono text-[15px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
          autoComplete="off"
          aria-label="Agent name"
        />
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-tertiary">
          Sepolia name we check: <span className="text-secondary">{ensPreview || "—"}</span>
          <span className="mt-1 block text-tertiary/90">
            Its <span className="text-secondary">address</span> record must be your linked wallet. Use a full name
            ending in <span className="text-secondary">.eth</span> here (e.g. yours from the ENS app); short names
            become <span className="text-secondary">name.persona.eth</span>.
          </span>
        </p>
      </label>

      <div className="mt-14 flex items-center gap-4">
        <motion.div
          key={glyph}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.2 }}
          className="flex size-12 shrink-0 items-center justify-center rounded-ui border border-[rgba(232,255,90,0.3)] text-[24px] text-accent"
          aria-hidden
        >
          {glyph}
        </motion.div>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="ok"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-12 items-center justify-center rounded-control bg-[rgba(74,222,128,0.12)] font-mono text-[12px] font-medium tracking-[0.1em] text-success"
              >
                PERSONA LIVE
              </motion.div>
            ) : (
              <motion.button
                key="mint"
                type="button"
                disabled={!canMint || minting}
                onClick={() => runMint().catch(() => {})}
                className={`flex h-12 w-full items-center justify-center gap-2 rounded-control font-mono text-[12px] font-medium tracking-[0.1em] transition-colors ${
                  canMint && !minting
                    ? "bg-accent text-void hover:bg-[#F0FF70]"
                    : "cursor-not-allowed bg-white/[0.06] text-tertiary"
                }`}
              >
                {minting ? (
                  <>
                    <svg className="spinner-700 size-4 text-void" viewBox="0 0 24 24" fill="none" aria-hidden>
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
                    <AnimatePresence mode="wait">
                      <motion.span
                        key={phaseLabel || "…"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="truncate"
                      >
                        {phaseLabel || "…"}
                      </motion.span>
                    </AnimatePresence>
                  </>
                ) : (
                  "MINT PERSONA"
                )}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
      {err ? <p className="mt-4 font-mono text-[13px] text-error">{err}</p> : null}

      {success && mintReceipt ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-10 space-y-4"
        >
          <DeploymentProofsPanel
            agent={mintReceipt.agent}
            deployment={mintReceipt.deployment}
            ensMetadataWritten={mintReceipt.ensMetadataWritten}
            showDeepLink
          />
          <p className="font-mono text-[10px] leading-relaxed text-tertiary/90">
            Use <span className="text-secondary">Deployment page</span> above for a bookmarkable URL with the same proofs.
            Chat from <span className="text-secondary">Console</span> (0G Compute + Storage each turn).
          </p>
        </motion.div>
      ) : null}
    </div>
  );
}
