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
import { AdvisorMarketplaceCard } from "@/components/agents/AdvisorMarketplaceCard";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { UnderlineTextarea } from "@/components/ui/UnderlineTextarea";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { formatConsultationPrice } from "@/lib/advisorUi";

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
  { value: "formal" as const, label: "Formal" },
  { value: "friendly" as const, label: "Friendly" },
  { value: "analytical" as const, label: "Analytical" },
];

const PAID_WEI = "10000000000000000";

export function StepCreate({ onMinted, advisorTemplateId = null }: Props) {
  const { push } = useCommandLog();
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [professionChoice, setProfessionChoice] = useState<ProfessionValue | "Custom">("web3-architect");
  const [customProfession, setCustomProfession] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [experience, setExperience] = useState("");
  const [pitch, setPitch] = useState("");
  const [advisorTone, setAdvisorTone] = useState<"formal" | "friendly" | "analytical">("friendly");
  const [isFree, setIsFree] = useState(true);
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
      `Consultation style: ${TONE_OPTIONS.find((x) => x.value === advisorTone)?.label ?? advisorTone}. Alter professional advisor.`,
    [advisorTone]
  );

  const pricingWei = isFree ? "0" : PAID_WEI;
  const previewPriceLabel = formatConsultationPrice({
    pricePerRequest: pricingWei,
    currency: "eth-wei",
  });
  const previewIsFree = previewPriceLabel === "Free";

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

    setErr(null);
    setMinting(true);
    setSuccess(false);
    setMintReceipt(null);

    const phases: { label: string; ms: number }[] = [
      { label: "VERIFYING IDENTITY...", ms: 500 },
      { label: "UPLOADING TO 0G STORAGE...", ms: 1000 },
      { label: "MINTING iNFT ON-CHAIN...", ms: 1200 },
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

  const tileOptions = PROFESSION_OPTIONS;

  return (
    <div className="flex w-full flex-col gap-12 pb-8 lg:flex-row lg:items-start lg:gap-10">
      <div className="min-w-0 flex-1 lg:max-w-[58%]">
        <p className="font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-[var(--text-2)]">CREATE</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold leading-tight text-[var(--text-0)]">
          Publish your expertise
        </h2>
        <p className="mt-3 max-w-[440px] font-mono text-[13px] font-normal leading-relaxed text-[var(--text-1)]">
          Train an AI on your knowledge. Set a price. Earn per consultation. You own it — on-chain.
        </p>

        <div className="mt-10 space-y-7">
          <div>
            <p className="mb-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
              Profession
            </p>
            <div className="grid grid-cols-2 gap-2">
              {tileOptions.map((o) => {
                const isThis = professionChoice === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setProfessionChoice(o.value as ProfessionValue | "Custom")}
                    className={`relative flex h-[52px] items-center gap-2.5 rounded-[var(--radius-sm)] border px-3.5 text-left transition-all duration-150 ${
                      isThis
                        ? "border-[rgba(232,255,90,0.5)] bg-[var(--accent-dim)] text-[var(--text-0)]"
                        : "border-[var(--border-1)] bg-[var(--bg-1)] text-[var(--text-1)] hover:border-[var(--border-2)] hover:bg-[var(--bg-2)]"
                    }`}
                  >
                    <span className="text-lg" aria-hidden>
                      {o.emoji}
                    </span>
                    <span className="font-mono text-[13px] font-normal">{o.label}</span>
                    {isThis ? (
                      <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--accent)]" aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {professionChoice === "Custom" ? (
              <div className="mt-4">
                <UnderlineInput
                  label="CUSTOM TITLE"
                  value={customProfession}
                  onChange={(e) => setCustomProfession(e.target.value)}
                  placeholder="e.g. Fractional CFO"
                  autoComplete="off"
                />
              </div>
            ) : null}
          </div>

          <UnderlineInput
            label="DISPLAY NAME"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jordan or jordan.eth"
            autoComplete="off"
          />
          <p className="-mt-4 font-mono text-[11px] font-normal text-[var(--text-2)]">
            ENS preview: <span className="text-[var(--text-1)]">{ensPreview || "—"}</span>
          </p>

          <UnderlineInput
            label="SPECIALIZATION"
            value={specialization}
            onChange={(e) => setSpecialization(e.target.value)}
            placeholder='e.g. "Crypto law", "DeFi trading"'
            autoComplete="off"
          />

          <UnderlineTextarea
            label="EXPERIENCE & CREDIBILITY"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder='e.g. "5+ years", "Big4 + Web3 startups"'
            rows={2}
          />

          <UnderlineTextarea
            label="YOUR PITCH"
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            placeholder="In one sentence, what makes you the expert..."
            rows={3}
          />

          <div>
            <p className="mb-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
              Tone
            </p>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setAdvisorTone(o.value)}
                  className={`h-8 rounded-full px-4 font-mono text-[13px] font-normal transition-all duration-150 ${
                    advisorTone === o.value
                      ? "bg-[var(--accent)] text-[var(--bg-0)]"
                      : "border border-[var(--border-1)] text-[var(--text-1)] hover:border-[var(--border-2)]"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
              Pricing
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                role="switch"
                aria-checked={!isFree}
                onClick={() => setIsFree((f) => !f)}
                className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-150 ${
                  isFree ? "bg-[var(--bg-3)]" : "bg-[var(--accent)]"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-3.5 rounded-full bg-[var(--text-0)] transition-transform duration-150 ease-out ${
                    isFree ? "left-0.5" : "left-[calc(100%-1rem)]"
                  }`}
                />
              </button>
              <span className="font-mono text-[13px] text-[var(--text-1)]">{isFree ? "Free" : "Paid"}</span>
              {!isFree ? (
                <span className="font-mono text-sm text-[var(--text-0)]">
                  <span className="text-[var(--text-2)]">$</span>0.01 ETH / consult
                </span>
              ) : null}
            </div>
            <p className="mt-2 font-mono text-[11px] font-normal text-[var(--text-2)]">
              Charged per consultation via USDC
            </p>
          </div>
        </div>

        <div className="mt-10">
          <AnimatePresence mode="wait">
            {success ? (
              <motion.div
                key="ok"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex h-[52px] items-center justify-center rounded-[var(--radius-sm)] bg-[var(--success-dim)] font-mono text-[13px] font-medium tracking-[0.1em] text-[var(--success)]"
              >
                ADVISOR LIVE
              </motion.div>
            ) : (
              <motion.div key="mint" initial={false}>
                <PrimaryButton
                  label={minting ? phaseLabel || "…" : "PUBLISH ADVISOR →"}
                  onClick={() => runMint().catch(() => {})}
                  disabled={!canMint || minting}
                  loading={minting}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {err ? <p className="mt-4 font-mono text-[13px] text-[var(--error)]">{err}</p> : null}

        {success && mintReceipt ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="mt-10 space-y-4"
          >
            <DeploymentProofsPanel
              agent={mintReceipt.agent}
              deployment={mintReceipt.deployment}
              ensMetadataWritten={mintReceipt.ensMetadataWritten}
              showDeepLink
            />
          </motion.div>
        ) : null}
      </div>

      <div className="w-full shrink-0 lg:sticky lg:top-12 lg:max-w-[42%]">
        <p className="mb-3 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">PREVIEW</p>
        <AdvisorMarketplaceCard
          preview
          variant="grid"
          name={name.trim()}
          profession={resolvedProfession}
          specialization={specialization.trim()}
          experience={experience.trim()}
          pitch={pitch.trim()}
          verified={false}
          priceLabel={previewPriceLabel}
          isFree={previewIsFree}
        />

        <p className="mb-3 mt-10 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
          AFTER YOU PUBLISH
        </p>
        <ol className="space-y-2.5">
          {[
            "Persona JSON → 0G Storage (your knowledge)",
            "iNFT minted → 0G Galileo Testnet",
            "ENS name → points to your advisor",
            "Listed in marketplace → clients can consult",
          ].map((line, i) => (
            <li key={line} className="flex gap-3">
              <span className="w-6 shrink-0 font-mono text-[10px] text-[var(--text-2)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-mono text-xs font-normal text-[var(--text-1)]">{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
