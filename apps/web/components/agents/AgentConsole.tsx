"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { apiGet, apiPost } from "@/lib/api";
import { shortenRoot } from "@/lib/formatRoot";
import type {
  AgentRequestResponse,
  DelegateResponse,
  ExecutionLogPayload,
  PublicAgent,
  TrainingDocument,
} from "@/lib/agentTypes";
import { ExecutionLogViewer } from "./ExecutionLogViewer";
import { MarkdownBody } from "./MarkdownBody";
import { useCommandLog, formatTime } from "@/components/command-log/CommandLogProvider";
import {
  formatConsultationPrice,
  formatProfessionLabel,
  isWeb3ArchitectProfession,
  professionEmoji,
} from "@/lib/advisorUi";
import { professionBadgeVariant } from "@/lib/professionBadgeVariant";
import { Badge } from "@/components/ui/Badge";
import { ProfessionGlyph } from "@/components/ui/ProfessionGlyph";
import { HashDisplay } from "@/components/ui/HashDisplay";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GhostButton } from "@/components/ui/GhostButton";
import { UnderlineInput } from "@/components/ui/UnderlineInput";
import { contentFingerprint } from "@/lib/contentFingerprint";

type UserMsg = { role: "user"; text: string };

type AgentMsg = {
  role: "agent";
  text: string;
  executionLog?: ExecutionLogPayload;
  memoryRootBefore?: string | null;
  memoryRootAfter?: string;
  reflectionTriggered?: boolean;
  delegateConversation?: { from: "A" | "B"; message: string }[];
  agentLabels?: { a: string; b: string };
};

type ChatMsg = UserMsg | AgentMsg;

type Props = {
  initialEns?: string;
};

type TrainingPayload = {
  docs: TrainingDocument[];
  docCount?: number;
  manifest?: { totalSizeBytes: number };
  trainingRoot?: string | null;
};

type Receipt = {
  turn: number;
  qFp: string;
  aFp: string;
  memBefore: string | null;
  memAfter: string | null;
  at: string;
};

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 font-mono text-[12px] text-[var(--accent)]" aria-live="polite">
      <span className="cursor-blink">▍</span>
      <span className="animate-pulse">thinking</span>
    </span>
  );
}

function docTypeBadge(filename: string): { label: string; cls: string } {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return { label: "PDF", cls: "bg-[rgba(245,158,11,0.15)] text-[#FBBF24]" };
  if (lower.endsWith(".md")) return { label: "MD", cls: "bg-[rgba(56,189,248,0.12)] text-[#38BDF8]" };
  return { label: "TXT", cls: "bg-[rgba(45,212,191,0.12)] text-[#5EEAD4]" };
}

/** Deep link on [0G StorageScan](https://storagescan-galileo.0g.ai) — ChainScan has no /storage/ route for roots. */
function zgStorageSubmissionUrl(storageScanBase: string, root: string | null | undefined): string | null {
  const base = storageScanBase.replace(/\/$/, "");
  if (!base || !root?.trim()) return null;
  const r = root.trim();
  if (r === "—") return null;
  const hex = r.startsWith("0x") ? r : `0x${r}`;
  if (!/^0x[0-9a-fA-F]+$/i.test(hex)) return null;
  return `${base}/submission/${hex}`;
}

export function AgentConsole({ initialEns = "" }: Props) {
  const { push, lines } = useCommandLog();
  const [targetEns, setTargetEns] = useState(initialEns);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [liveMemoryHead, setLiveMemoryHead] = useState<string | null>(null);
  const [memoryFlash, setMemoryFlash] = useState(false);
  const [agentLoadErr, setAgentLoadErr] = useState<string | null>(null);
  const [training, setTraining] = useState<TrainingPayload | null>(null);

  const [delegateMode, setDelegateMode] = useState(false);
  const [fromAgentEns, setFromAgentEns] = useState("");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [zgExplorerBase, setZgExplorerBase] = useState("");
  const [zgStorageScanBase, setZgStorageScanBase] = useState("");
  const turnRef = useRef(0);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiGet<{ zgExplorerUrl: string; zgStorageScanUrl?: string }>("/config/public")
      .then((c) => {
        setZgExplorerBase((c.zgExplorerUrl ?? "").replace(/\/$/, ""));
        setZgStorageScanBase(
          (c.zgStorageScanUrl ?? "https://storagescan-galileo.0g.ai").replace(/\/$/, ""),
        );
      })
      .catch(() => {
        setZgExplorerBase("https://chainscan-galileo.0g.ai");
        setZgStorageScanBase("https://storagescan-galileo.0g.ai");
      });
  }, []);

  useEffect(() => {
    if (initialEns) setTargetEns(initialEns);
  }, [initialEns]);

  const normalizedEns = useMemo(() => targetEns.trim().toLowerCase(), [targetEns]);

  const askPlaceholder = useMemo(() => {
    if (agent && isWeb3ArchitectProfession(agent.profession)) {
      return 'e.g. "Design a token for my DeFi lending platform"';
    }
    return "Ask for advice...";
  }, [agent]);

  const loadAgent = useCallback(async () => {
    if (!normalizedEns) {
      setAgent(null);
      setLiveMemoryHead(null);
      setAgentLoadErr(null);
      setTraining(null);
      return;
    }
    setAgentLoadErr(null);
    try {
      const { agent: a } = await apiGet<{ agent: PublicAgent }>(
        `/agents/by-ens/${encodeURIComponent(normalizedEns)}`
      );
      setAgent(a);
      setLiveMemoryHead(a.memoryHead ?? null);
    } catch {
      setAgent(null);
      setLiveMemoryHead(null);
      setTraining(null);
      setAgentLoadErr("Profile not in local registry — you can still try messaging (API may resolve via ENS).");
    }
  }, [normalizedEns]);

  useEffect(() => {
    loadAgent().catch(() => {});
  }, [loadAgent]);

  useEffect(() => {
    if (!agent?.id) {
      setTraining(null);
      return;
    }
    let cancelled = false;
    apiGet<TrainingPayload>(`/agents/${encodeURIComponent(agent.id)}/training`)
      .then((data) => {
        if (!cancelled) setTraining(data);
      })
      .catch(() => {
        if (!cancelled) setTraining(null);
      });
    return () => {
      cancelled = true;
    };
  }, [agent?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  useEffect(() => {
    if (!liveMemoryHead) return;
    setMemoryFlash(true);
    const t = window.setTimeout(() => setMemoryFlash(false), 600);
    return () => clearTimeout(t);
  }, [liveMemoryHead]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const ens = normalizedEns;
    if (!ens) {
      setError("Enter an advisor ENS name.");
      return;
    }

    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setPending(true);

    const qFp = await contentFingerprint(text);

    try {
      if (delegateMode) {
        const fromE = fromAgentEns.trim().toLowerCase();
        if (!fromE) {
          setError("Delegate mode requires coordinator advisor (A) ENS.");
          setPending(false);
          setMessages((m) => m.slice(0, -1));
          return;
        }
        const res = await apiPost<DelegateResponse>("/agent/delegate", {
          fromAgentENS: fromE,
          toAgentENS: ens,
          message: text,
        });
        const aFp = await contentFingerprint(res.reply);
        turnRef.current += 1;
        const nextHead = res.memoryRoot ?? null;
        setReceipt({
          turn: turnRef.current,
          qFp,
          aFp,
          memBefore: liveMemoryHead,
          memAfter: nextHead,
          at: new Date().toISOString(),
        });
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: res.reply,
            executionLog: res.executionLog ?? null,
            delegateConversation: res.conversation,
            agentLabels: { a: res.agentA.ensFullName, b: res.agentB.ensFullName },
          },
        ]);
        if (res.memoryRoot) setLiveMemoryHead(res.memoryRoot);
        push({ level: "success", event: "DELEGATE_REPLY", value: res.agentB.ensFullName.slice(0, 24) });
      } else {
        const res = await apiPost<AgentRequestResponse>("/agent/request", {
          targetEns: ens,
          message: text,
        });
        const aFp = await contentFingerprint(res.reply);
        turnRef.current += 1;
        const nextHead = res.memoryRootAfter ?? res.memoryRoot ?? null;
        setReceipt({
          turn: turnRef.current,
          qFp,
          aFp,
          memBefore: res.memoryRootBefore ?? liveMemoryHead,
          memAfter: nextHead,
          at: new Date().toISOString(),
        });
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: res.reply,
            executionLog: res.executionLog ?? null,
            memoryRootBefore: res.memoryRootBefore,
            memoryRootAfter: res.memoryRootAfter ?? res.memoryRoot,
            reflectionTriggered: res.reflectionTriggered,
          },
        ]);
        if (nextHead) setLiveMemoryHead(nextHead);
        push({ level: "success", event: "ADVISOR_REPLY", value: res.agentId.slice(0, 8) });
      }
    } catch (e) {
      const msg = String(e);
      setError(msg);
      push({ level: "error", event: "AGENT_ERR", value: msg.slice(0, 48) });
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: msg,
          executionLog: null,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const logLines = lines.slice(-3);
  const profession = agent?.profession?.trim() || "Advisor";
  const priceLabel = formatConsultationPrice(agent?.pricing ?? null);
  const isFree = priceLabel === "Free";
  const mb = training?.manifest?.totalSizeBytes ?? 0;
  const mbStr = (mb / (1024 * 1024)).toFixed(1);
  const topDocs = (training?.docs ?? []).slice(0, 3);

  const trainingExplorerRoot = useMemo(() => {
    const tr = training?.trainingRoot?.trim();
    if (tr) return tr;
    const h = training?.docs?.[0]?.hash?.trim();
    if (h) return h;
    return agent?.configRoot?.trim() ?? null;
  }, [training?.trainingRoot, training?.docs, agent?.configRoot]);

  const trainingStorageUrl = useMemo(
    () => zgStorageSubmissionUrl(zgStorageScanBase, trainingExplorerRoot),
    [zgStorageScanBase, trainingExplorerRoot],
  );

  const receiptStorageUrl = useMemo(() => {
    const root = receipt?.memAfter?.trim() || receipt?.memBefore?.trim() || null;
    return zgStorageSubmissionUrl(zgStorageScanBase, root);
  }, [zgStorageScanBase, receipt?.memAfter, receipt?.memBefore]);

  const configStorageUrl = useMemo(
    () => zgStorageSubmissionUrl(zgStorageScanBase, agent?.configRoot),
    [zgStorageScanBase, agent?.configRoot],
  );
  const memoryStorageUrl = useMemo(
    () => zgStorageSubmissionUrl(zgStorageScanBase, liveMemoryHead),
    [zgStorageScanBase, liveMemoryHead],
  );

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden border border-[var(--border-0)] bg-[var(--bg-0)]">
      {/* LEFT */}
      <aside className="scrollbar-none flex min-h-0 w-[260px] shrink-0 flex-col overflow-y-auto border-r border-[var(--border-0)] px-4 py-4">
        <SectionLabel label="ADVISOR" />
        <div className="mt-2">
          <UnderlineInput
            label="ENS NAME"
            value={targetEns}
            onChange={(e) => setTargetEns(e.target.value)}
            onBlur={() => loadAgent().catch(() => {})}
            onKeyDown={(e) => {
              if (e.key === "Enter") loadAgent().catch(() => {});
            }}
            placeholder="lex.counsel.eth"
            autoComplete="off"
          />
        </div>
        <GhostButton
          label="LOAD ADVISOR"
          size="sm"
          className="mt-2"
          onClick={() => loadAgent().catch(() => {})}
        />

        {agentLoadErr ? (
          <p className="mt-3 font-mono text-[11px] leading-relaxed text-[var(--pending)]">{agentLoadErr}</p>
        ) : null}

        {agent ? (
          <>
            <div className="my-3 h-px bg-[var(--border-0)]" />
            <SectionLabel label="YOU ARE CONSULTING" className="mb-2" />
            <div className="rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] p-2.5">
              <div className="flex items-center gap-2">
                <ProfessionGlyph profession={profession} size="sm" />
                <span className="truncate font-mono text-[13px] font-medium text-[var(--text-0)]">{agent.name}</span>
              </div>
              <div className="mt-2">
                <Badge
                  variant="profession"
                  profession={professionBadgeVariant(agent.profession)}
                  label={formatProfessionLabel(agent.profession)}
                />
              </div>
              <p
                className={`mt-2 font-mono text-[12px] font-medium ${isFree ? "text-[var(--success)]" : "text-[var(--accent)]"}`}
              >
                {priceLabel}
              </p>
            </div>

            <div className="my-3 h-px bg-[var(--border-0)]" />
            <SectionLabel label="ON-CHAIN PROOF" className="mb-2" />
            <HashDisplay hash={agent.configRoot || "—"} label="Config root" />
            {configStorageUrl ? (
              <a
                href={configStorageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block font-mono text-[10px] text-[var(--accent)] no-underline hover:underline"
              >
                Config on StorageScan ↗
              </a>
            ) : null}
            <div className="mt-2">
              <HashDisplay
                hash={liveMemoryHead || "—"}
                label="Memory root"
                valueClassName={memoryFlash ? "!text-[var(--accent)]" : ""}
              />
              <p className="mt-0.5 font-mono text-[10px] text-[var(--text-2)]">● live — updates each turn</p>
              {memoryStorageUrl ? (
                <a
                  href={memoryStorageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-mono text-[10px] text-[var(--accent)] no-underline hover:underline"
                >
                  Memory on StorageScan ↗
                </a>
              ) : null}
            </div>

            <div className="my-3 h-px bg-[var(--border-0)]" />
            <SectionLabel label="LOG" className="mb-1.5" />
            <ul className="space-y-1">
              <AnimatePresence initial={false}>
                {logLines.map((line) => (
                  <motion.li
                    key={line.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: line.faded ? 0.45 : 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="flex min-w-0 gap-1.5 font-mono text-[11px]"
                  >
                    <span className="shrink-0 text-[var(--text-2)]">{formatTime(line.ts)}</span>
                    <span
                      className="shrink-0"
                      style={{
                        color:
                          line.level === "success"
                            ? "var(--success)"
                            : line.level === "error"
                              ? "var(--error)"
                              : line.level === "pending"
                                ? "var(--pending)"
                                : "var(--text-2)",
                      }}
                      aria-hidden
                    >
                      ●
                    </span>
                    <span className="min-w-0 shrink text-[var(--text-1)]">{line.event}</span>
                    <span className="min-w-0 truncate text-[var(--text-0)]">{line.value}</span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </>
        ) : null}
      </aside>

      {/* CENTER */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-[var(--border-0)]">
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--border-0)] px-6">
          <span className="font-mono text-[11px] font-normal text-[var(--text-2)]">CONSULTATION CONSOLE</span>
          {agent ? (
            <span className="truncate font-mono text-[11px] text-[var(--text-0)]">{agent.ensFullName}</span>
          ) : null}
        </div>

        <div className="scrollbar-none min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {!messages.length && !pending ? (
            <p className="font-mono text-[12px] text-[var(--text-2)]">
              Ask for tailored professional advice.
            </p>
          ) : null}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[70%] rounded-[var(--radius-md)] border border-[var(--accent-mid)] bg-[var(--accent-dim)] px-4 py-3 font-mono text-[13px] font-normal leading-[1.65] text-[var(--text-0)]">
                  {m.text}
                </div>
              </div>
            ) : (
              <div key={i} className="flex max-w-[85%] flex-col items-start">
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--accent-mid)] bg-[var(--accent-dim)] text-[12px]" aria-hidden>
                    {professionEmoji(agent?.profession ?? "Advisor")}
                  </span>
                  <span className="font-mono text-xs font-medium text-[var(--text-0)]">
                    {agent?.name ?? "Advisor"}
                  </span>
                </div>
                {m.delegateConversation?.length ? (
                  <div className="mb-3 w-full space-y-2 rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--accent)]">
                      Multi-agent trace
                    </p>
                    {m.delegateConversation.map((line, j) => (
                      <div key={j} className="font-mono text-[11px] text-[var(--text-1)]">
                        <span className="text-[var(--text-2)]">
                          {line.from === "A" ? (m.agentLabels?.a ?? "A") : m.agentLabels?.b ?? "B"}:
                        </span>{" "}
                        <span className="whitespace-pre-wrap text-[var(--text-0)]">{line.message}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="w-full rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--bg-1)] px-[18px] py-4">
                  <MarkdownBody>{m.text}</MarkdownBody>
                </div>
                <ExecutionLogViewer executionLog={m.executionLog ?? null} />
              </div>
            )
          )}

          {pending ? (
            <div className="flex justify-start">
              <div className="rounded-[var(--radius-md)] border border-[var(--accent-mid)] bg-[var(--bg-1)] px-4 py-3">
                <TypingDots />
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-[var(--border-0)] px-6 py-4">
          <label className="mb-2 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-[var(--text-1)]">
            <input
              type="checkbox"
              checked={delegateMode}
              onChange={(e) => setDelegateMode(e.target.checked)}
              className="accent-[var(--accent)]"
            />
            Multi-advisor delegate (A coordinates B)
          </label>
          {delegateMode ? (
            <UnderlineInput
              label="COORDINATOR ENS (A)"
              value={fromAgentEns}
              onChange={(e) => setFromAgentEns(e.target.value)}
              placeholder="coordinator.eth"
              className="mb-3"
            />
          ) : null}
          {error ? <p className="mb-2 font-mono text-[11px] text-[var(--error)]">{error}</p> : null}
          <div className="flex items-end gap-3">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Message</span>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    send().catch(() => {});
                  }
                }}
                rows={3}
                placeholder={askPlaceholder}
                disabled={pending}
                className="max-h-[120px] min-h-[44px] w-full resize-none rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] px-3.5 py-3 font-mono text-[13px] font-normal text-[var(--text-0)] placeholder:text-[var(--text-3)] focus:border-[var(--border-3)] focus:outline-none disabled:opacity-50"
                aria-label="Ask for advice"
              />
            </label>
            <button
              type="button"
              disabled={pending || !input.trim() || !normalizedEns}
              onClick={() => send().catch(() => {})}
              className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] text-[var(--bg-0)] transition-opacity duration-150 hover:opacity-[0.88] active:scale-[0.96] disabled:bg-[var(--bg-3)] disabled:opacity-100"
              aria-label="Send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M12 5v14M5 12l7-7 7 7"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* RIGHT */}
      <aside className="scrollbar-none flex min-h-0 w-[280px] shrink-0 flex-col overflow-y-auto px-4 py-4">
        <SectionLabel label="TRAINING CORPUS" />
        {training && (training.docCount ?? training.docs?.length ?? 0) > 0 ? (
          <div className="mt-3">
            <p className="font-mono text-[11px] text-[var(--text-1)]">
              {training.docCount ?? training.docs.length} documents · {mbStr} MB
            </p>
            <Link
              href={agent ? `/agent/${encodeURIComponent(agent.id)}/training` : "#"}
              className="mt-1 inline-block font-mono text-[11px] text-[var(--accent)] no-underline hover:underline"
            >
              View all →
            </Link>
            <ul className="mt-3 border-t border-[var(--border-0)]">
              {topDocs.map((d) => {
                const b = docTypeBadge(d.filename);
                return (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 border-b border-[var(--border-0)] py-1.5 font-mono text-[10px]"
                  >
                    <span className={`shrink-0 rounded px-1 py-0.5 ${b.cls}`}>{b.label}</span>
                    <span className="min-w-0 flex-1 truncate text-[var(--text-1)]">{d.filename}</span>
                    <span className="shrink-0 text-[var(--text-2)]">
                      {d.hash.length > 10 ? `${d.hash.slice(0, 4)}…` : d.hash}
                    </span>
                  </li>
                );
              })}
            </ul>
            <a
              href={(trainingStorageUrl ?? zgStorageScanBase) || "https://storagescan-galileo.0g.ai"}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block font-mono text-[11px] text-[var(--text-2)] no-underline transition-colors hover:text-[var(--text-1)]"
            >
              {trainingStorageUrl ? "View on StorageScan ↗" : "StorageScan (home) ↗"}
            </a>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-[var(--text-2)]">No training documents</p>
        )}

        <div className="my-5 h-px bg-[var(--border-0)]" />
        <SectionLabel label="CONSULTATION RECEIPT" />
        {receipt ? (
          <div className="mt-3 space-y-2">
            <p className="font-mono text-[11px] text-[var(--text-2)]">
              Turn {receipt.turn} · {receipt.at.slice(11, 19)} UTC
            </p>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[var(--text-2)]">Q</span>
              <span className="truncate text-[var(--text-1)]">{receipt.qFp}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="text-[var(--text-2)]">A</span>
              <span className="truncate text-[var(--text-1)]">{receipt.aFp}</span>
            </div>
            {receipt.memAfter && receipt.memBefore !== receipt.memAfter ? (
              <p className="font-mono text-[10px] text-[var(--success)]">Memory updated</p>
            ) : null}
            {(receipt.memBefore || receipt.memAfter) && (
              <p className="break-all font-mono text-[10px] text-[var(--text-2)]">
                {receipt.memBefore ? shortenRoot(receipt.memBefore, 6, 4) : "—"} →{" "}
                {receipt.memAfter ? shortenRoot(receipt.memAfter, 6, 4) : "—"}
              </p>
            )}
            <a
              href={(receiptStorageUrl ?? zgStorageScanBase) || "https://storagescan-galileo.0g.ai"}
              target="_blank"
              rel="noreferrer"
              className="inline-block font-mono text-[11px] text-[var(--accent)] no-underline hover:underline"
            >
              {receiptStorageUrl ? "View memory on StorageScan ↗" : "StorageScan (home) ↗"}
            </a>
          </div>
        ) : (
          <p className="mt-3 font-mono text-[11px] text-[var(--text-2)]">Send a message to generate a receipt.</p>
        )}
      </aside>
    </div>
  );
}
