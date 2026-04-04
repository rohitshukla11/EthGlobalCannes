"use client";

import { useEffect, useMemo, useState } from "react";
import { sleep } from "@/lib/sleep";
import { AnimatePresence, motion } from "framer-motion";
import { getStoredToken } from "@/lib/session";
import { apiPost } from "@/lib/api";
import { DeploymentProofsPanel } from "@/components/deployment/DeploymentProofsPanel";
import { useAccount } from "wagmi";
import { useCommandLog } from "@/components/command-log/CommandLogProvider";
import { PROFESSION_OPTIONS, type ProfessionValue } from "@/lib/advisorUi";
import { DEMO_ADVISOR_TEMPLATES } from "@/lib/demoAdvisorTemplates";

function slugName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 32);
}

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
  advisorTemplateId?: string | null;
};

const TONE_OPTIONS = [
  { value: "formal" as const, label: "Formal", hint: "Precise, structured" },
  { value: "friendly" as const, label: "Friendly", hint: "Warm, approachable" },
  { value: "analytical" as const, label: "Analytical", hint: "Data-led, tradeoffs" },
];

const PRICE_OPTIONS = [
  { value: "free" as const, label: "Free", wei: "0" },
  { value: "point01" as const, label: "0.01 ETH / consultation", wei: "10000000000000000" },
];

export function StepCreate({ onMinted, advisorTemplateId = null }: Props) {
  const { push } = useCommandLog();
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [professionChoice, setProfessionChoice] = useState<ProfessionValue | "Custom">("Consultant");
  const [customProfession, setCustomProfession] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experience, setExperience] = useState("");
  const [pitch, setPitch] = useState("");
  const [advisorTone, setAdvisorTone] = useState<"formal" | "friendly" | "analytical">("friendly");
  const [priceTier, setPriceTier] = useState<"free" | "point01">("free");
  const [minting, setMinting] = useState(false);
  const [phaseLabel, setPhaseLabel] = useState("");
  const [success, setSuccess] = useState(false);
  const [mintReceipt, setMintReceipt] = useState<CreateAgentResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!advisorTemplateId) return;
    const t = DEMO_ADVISOR_TEMPLATES.find((d) => d.id === advisorTemplateId);
    if (!t) return;
    const known = PROFESSION_OPTIONS.filter((o) => o.value !== "Custom").find((o) => o.value === t.profession);
    if (known) setProfessionChoice(known.value as ProfessionValue);
    else {
      setProfessionChoice("Custom");
      setCustomProfession(t.profession);
    }
    setSpecialization(t.specialization);
    setExperience(t.experience);
    setPitch(t.pitch);
    setAdvisorTone(t.advisorTone);
  }, [advisorTemplateId]);

  const ensPreview = useMemo(() => buildEnsFullName(name), [name]);
  const resolvedProfession = useMemo(() => {
    if (professionChoice === "Custom") return customProfession.trim() || "Advisor";
    return professionChoice;
  }, [professionChoice, customProfession]);

  const personality = useMemo(
    () =>
      `Consultation style: ${TONE_OPTIONS.find((x) => x.value === advisorTone)?.label ?? advisorTone}. Counselr professional advisor.`,
    [advisorTone]
  );

  const canMint =
    name.trim().length > 0 &&
    specialization.trim().length > 0 &&
    experience.trim().length > 0 &&
    pitch.trim().length > 0 &&
    (professionChoice !== "Custom" || customProfession.trim().length > 0);

  async function runMint() {
    const t = getStoredToken();
    if (!t || !address) {
      setErr("Session or wallet missing");
      return;
    }
    if (!canMint) {
      setErr("Fill profession, specialization, experience, and pitch.");
      return;
    }
    const ensFullName = buildEnsFullName(name);
    if (!ensFullName || ensFullName === ".persona.eth") {
      setErr("Invalid name");
      return;
    }

    const pricingWei = PRICE_OPTIONS.find((p) => p.value === priceTier)?.wei ?? "0";

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
      push({ level: "pending", event: "STORAGE", value: "writing advisor config..." });
      const fetchPromise = apiPost<CreateAgentResponse>(
        "/agents",
        {
          name: name.trim(),
          expertise: pitch.trim(),
          personality,
          ensFullName,
          profession: resolvedProfession,
          specialization: specialization.trim(),
          experience: experience.trim(),
          advisorTone,
          pricing: {
            pricePerRequest: pricingWei,
            ownerWallet: address,
            currency: "eth-wei",
          },
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
      <div className="mt-2 space-y-8">
        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Display name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan or jordan.eth"
            className="w-full border-0 border-b border-dim bg-transparent py-2 font-mono text-[15px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
            autoComplete="off"
            aria-label="Advisor display name"
          />
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-tertiary">
            Sepolia ENS checked: <span className="text-secondary">{ensPreview || "—"}</span>
            <span className="mt-1 block">
              Address record must match your linked wallet. Use a full <span className="text-secondary">.eth</span> or a
              short name → <span className="text-secondary">slug.persona.eth</span>.
            </span>
          </p>
        </label>

        <div className="grid gap-6 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Profession</span>
            <select
              value={professionChoice}
              onChange={(e) => setProfessionChoice(e.target.value as ProfessionValue | "Custom")}
              className="h-10 w-full rounded-control border border-mid bg-black/50 px-3 font-mono text-[13px] text-primary focus:border-accent focus:outline-none"
            >
              {PROFESSION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
          </label>
          {professionChoice === "Custom" ? (
            <label className="block sm:col-span-1">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Custom title</span>
              <input
                value={customProfession}
                onChange={(e) => setCustomProfession(e.target.value)}
                placeholder="e.g. Fractional CFO"
                className="h-10 w-full rounded-control border border-mid bg-black/50 px-3 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
              />
            </label>
          ) : null}
        </div>

        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Specialization</span>
          <input
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder='e.g. "Crypto law", "DeFi trading"'
            className="w-full rounded-control border border-mid bg-black/50 px-3 py-2.5 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Experience & credibility</span>
          <textarea
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder='e.g. "5+ years", "Big4 + Web3 startups"'
            rows={2}
            className="w-full resize-y rounded-control border border-mid bg-black/50 px-3 py-2.5 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Short pitch</span>
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder='One line, e.g. "Helping startups stay compliant in Web3"'
            rows={2}
            className="w-full resize-y rounded-control border border-mid bg-black/50 px-3 py-2.5 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
          />
        </label>

        <div>
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Tone / style</span>
          <div className="flex flex-wrap gap-2">
            {TONE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setAdvisorTone(o.value)}
                className={
                  advisorTone === o.value
                    ? "rounded-full border border-accent bg-[rgba(232,255,90,0.12)] px-4 py-2 text-left font-mono text-[12px] text-accent"
                    : "rounded-full border border-dim px-4 py-2 text-left font-mono text-[12px] text-secondary transition-colors hover:border-mid"
                }
              >
                <span className="block font-medium">{o.label}</span>
                <span className="block text-[10px] text-tertiary">{o.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
            Price per consultation (placeholder)
          </span>
          <select
            value={priceTier}
            onChange={(e) => setPriceTier(e.target.value as "free" | "point01")}
            className="h-10 w-full max-w-md rounded-control border border-mid bg-black/50 px-3 font-mono text-[13px] text-primary focus:border-accent focus:outline-none"
          >
            {PRICE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-2 font-mono text-[10px] text-tertiary">
            Stored with your advisor for marketplace display. On-chain settlement can wire later.
          </p>
        </label>
      </div>

      <div className="mt-14 flex items-center gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-ui border border-[rgba(232,255,90,0.3)] font-mono text-[14px] text-accent">
          CR
        </div>
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="ok"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-12 items-center justify-center rounded-control bg-[rgba(74,222,128,0.12)] font-mono text-[12px] font-medium tracking-[0.1em] text-success"
              >
                ADVISOR LIVE
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
                  "PUBLISH ADVISOR"
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
            Your advisor appears in <span className="text-secondary">Explore Advisors</span>. Consult from{" "}
            <span className="text-secondary">Console</span> — OpenClaw + 0G memory each session.
          </p>
        </motion.div>
      ) : null}
    </div>
  );
}
