"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";
import { shortenRoot } from "@/lib/formatRoot";
import type {
  AgentRequestResponse,
  DelegateResponse,
  ExecutionLogPayload,
  PublicAgent,
} from "@/lib/agentTypes";
import { ExecutionLogViewer } from "./ExecutionLogViewer";
import { MemoryUpdateBadge } from "./MemoryUpdateBadge";
import Link from "next/link";
import { useCommandLog } from "@/components/command-log/CommandLogProvider";

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

function ReadOnlySlider({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 50;
  return (
    <div className="font-mono text-[11px]">
      <div className="mb-1 flex justify-between text-secondary">
        <span>{label}</span>
        <span className="text-accent">{value === null ? "—" : value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={v}
        readOnly
        disabled
        className="w-full accent-accent opacity-80"
        aria-label={`${label} ${value ?? "unknown"}`}
      />
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-0.5 font-mono text-[12px] text-accent" aria-live="polite">
      <span className="cursor-blink">▍</span>
      <span className="animate-pulse">thinking</span>
    </span>
  );
}

export function AgentConsole({ initialEns = "" }: Props) {
  const { push } = useCommandLog();
  const [targetEns, setTargetEns] = useState(initialEns);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [liveMemoryHead, setLiveMemoryHead] = useState<string | null>(null);
  const [agentLoadErr, setAgentLoadErr] = useState<string | null>(null);

  const [delegateMode, setDelegateMode] = useState(false);
  const [fromAgentEns, setFromAgentEns] = useState("");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialEns) setTargetEns(initialEns);
  }, [initialEns]);

  const normalizedEns = useMemo(() => targetEns.trim().toLowerCase(), [targetEns]);

  const loadAgent = useCallback(async () => {
    if (!normalizedEns) {
      setAgent(null);
      setLiveMemoryHead(null);
      setAgentLoadErr(null);
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
      setAgentLoadErr("Profile not in local registry — you can still try messaging (API may resolve via ENS).");
    }
  }, [normalizedEns]);

  useEffect(() => {
    loadAgent().catch(() => {});
  }, [loadAgent]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function send() {
    const text = input.trim();
    if (!text || pending) return;
    const ens = normalizedEns;
    if (!ens) {
      setError("Enter an ENS name.");
      return;
    }

    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setPending(true);

    try {
      if (delegateMode) {
        const fromE = fromAgentEns.trim().toLowerCase();
        if (!fromE) {
          setError("Delegate mode requires coordinator agent (A) ENS.");
          setPending(false);
          setMessages((m) => m.slice(0, -1));
          return;
        }
        const res = await apiPost<DelegateResponse>("/agent/delegate", {
          fromAgentENS: fromE,
          toAgentENS: ens,
          message: text,
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
        const nextHead = res.memoryRootAfter ?? res.memoryRoot;
        if (nextHead) setLiveMemoryHead(nextHead);
        push({ level: "success", event: "AGENT_REPLY", value: res.agentId.slice(0, 8) });
      }
    } catch (e) {
      const msg = String(e);
      setError(msg);
      push({ level: "error", event: "AGENT_ERR", value: msg.slice(0, 48) });
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: `⚠ ${msg}`,
          executionLog: null,
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  const sliders = agent?.personalitySliders;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col gap-6 lg:flex-row lg:gap-8">
      {/* LEFT — agent info (~30%) */}
      <aside className="flex w-full shrink-0 flex-col rounded-ui border border-dim bg-[rgba(17,17,16,0.85)] p-6 backdrop-blur-sm lg:w-[30%] lg:max-w-sm">
        <p className="type-eyebrow mb-3">Agent</p>
        <label className="block">
          <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
            Target ENS
          </span>
          <input
            value={targetEns}
            onChange={(e) => setTargetEns(e.target.value)}
            onBlur={() => loadAgent().catch(() => {})}
            placeholder="aria.eth"
            className="h-10 w-full rounded-control border border-mid bg-black/50 px-3 font-mono text-[13px] text-primary focus:border-accent focus:outline-none"
            aria-label="Target ENS"
          />
        </label>
        <button
          type="button"
          onClick={() => loadAgent().catch(() => {})}
          className="mt-2 h-8 w-full rounded-control border border-dim font-mono text-[10px] uppercase tracking-[0.1em] text-secondary hover:border-mid hover:text-primary"
        >
          Refresh profile
        </button>

        {agentLoadErr ? <p className="mt-3 font-mono text-[10px] leading-relaxed text-pending">{agentLoadErr}</p> : null}

        {agent ? (
          <>
            <h2 className="mt-6 font-mono text-[16px] font-medium text-primary">{agent.ensFullName}</h2>
            <p className="mt-1 break-all font-mono text-[10px] text-tertiary">
              Owner <span className="text-secondary">{shortenRoot(agent.owner, 4, 4)}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {agent.openClawAgent ? (
                <span className="rounded-full border border-[rgba(232,255,90,0.45)] bg-[rgba(232,255,90,0.1)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-accent">
                  OpenClaw
                </span>
              ) : null}
              {agent.verifiedHumanTwin ? (
                <span className="rounded-full border border-[rgba(74,222,128,0.35)] bg-[rgba(74,222,128,0.08)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-success">
                  Human verified
                </span>
              ) : null}
            </div>

            <div className="mt-6 space-y-4">
              <p className="type-eyebrow">Personality</p>
              <ReadOnlySlider label="Humor" value={sliders?.humor ?? null} />
              <ReadOnlySlider label="Tone" value={sliders?.tone ?? null} />
              <ReadOnlySlider label="Intelligence" value={sliders?.intelligence ?? null} />
            </div>

            <dl className="mt-6 space-y-2 border-t border-dim pt-4 font-mono text-[10px] text-tertiary">
              <div>
                <dt className="text-tertiary">Config root</dt>
                <dd className="mt-0.5 break-all text-secondary">{shortenRoot(agent.configRoot, 10, 6)}</dd>
              </div>
              <div>
                <dt className="text-tertiary">Memory root (live)</dt>
                <dd className="mt-0.5 break-all text-accent">{shortenRoot(liveMemoryHead, 10, 6)}</dd>
              </div>
            </dl>

            <Link
              href={`/agent/${encodeURIComponent(agent.id)}`}
              className="mt-6 inline-block font-mono text-[11px] text-accent no-underline hover:underline"
            >
              Full profile →
            </Link>
          </>
        ) : null}
      </aside>

      {/* RIGHT — console (~70%) */}
      <section className="flex min-h-[480px] min-w-0 flex-1 flex-col rounded-ui border border-dim bg-black/40 backdrop-blur-sm">
        <div className="border-b border-dim px-4 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">
          Interaction console
        </div>

        <div className="flex flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {!messages.length && !pending ? (
              <p className="font-mono text-[12px] text-tertiary">
                Messages stream here. Each agent reply can unfold reasoning, memory roots, and evolution signals.
              </p>
            ) : null}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[88%] rounded-ui border border-mid bg-raised/90 px-4 py-3 font-mono text-[13px] leading-relaxed text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                    {m.text}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex justify-start">
                  <div className="max-w-[92%] rounded-ui border border-[rgba(232,255,90,0.22)] bg-[rgba(8,8,8,0.92)] px-4 py-3 font-mono text-[13px] leading-relaxed text-primary shadow-[0_0_24px_rgba(232,255,90,0.07)]">
                    {m.delegateConversation?.length ? (
                      <div className="mb-3 space-y-2 rounded-control border border-dim bg-black/35 px-3 py-2">
                        <p className="text-[9px] uppercase tracking-[0.12em] text-accent">Multi-agent trace</p>
                        {m.delegateConversation.map((line, j) => (
                          <div key={j} className="font-mono text-[11px] text-secondary">
                            <span className="text-tertiary">
                              {line.from === "A" ? (m.agentLabels?.a ?? "A") : m.agentLabels?.b ?? "B"}:
                            </span>{" "}
                            <span className="whitespace-pre-wrap text-primary/90">{line.message}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="whitespace-pre-wrap">{m.text}</div>
                    <ExecutionLogViewer executionLog={m.executionLog ?? null} />
                    {"memoryRootAfter" in m && m.memoryRootAfter ? (
                      <MemoryUpdateBadge
                        memoryRootBefore={m.memoryRootBefore}
                        memoryRootAfter={m.memoryRootAfter}
                        reflectionTriggered={m.reflectionTriggered}
                      />
                    ) : null}
                  </div>
                </div>
              )
            )}

            {pending ? (
              <div className="flex justify-start">
                <div className="rounded-ui border border-[rgba(232,255,90,0.15)] bg-[rgba(8,8,8,0.85)] px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-dim p-4">
            <label className="mb-3 flex cursor-pointer items-center gap-2 font-mono text-[11px] text-secondary">
              <input
                type="checkbox"
                checked={delegateMode}
                onChange={(e) => setDelegateMode(e.target.checked)}
                className="accent-accent"
              />
              Multi-agent delegate (A coordinates B)
            </label>
            {delegateMode ? (
              <label className="mb-3 block">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">
                  Coordinator agent ENS (A)
                </span>
                <input
                  value={fromAgentEns}
                  onChange={(e) => setFromAgentEns(e.target.value)}
                  placeholder="coordinator.eth"
                  className="h-10 w-full rounded-control border border-mid bg-void px-3 font-mono text-[13px] text-primary focus:border-accent focus:outline-none"
                />
              </label>
            ) : null}
            {error ? <p className="mb-2 font-mono text-[11px] text-error">{error}</p> : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className="block min-w-0 flex-1">
                <span className="sr-only">Message</span>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send().catch(() => {});
                    }
                  }}
                  placeholder="Send message to agent…"
                  className="h-11 w-full rounded-control border border-mid bg-void px-3.5 font-mono text-[13px] text-primary placeholder:text-tertiary focus:border-accent focus:outline-none"
                  disabled={pending}
                  aria-label="Send message to agent"
                />
              </label>
              <button
                type="button"
                disabled={pending || !input.trim()}
                onClick={() => send().catch(() => {})}
                className="h-11 shrink-0 rounded-control bg-accent px-6 font-mono text-[12px] font-medium uppercase tracking-[0.05em] text-void transition-colors hover:bg-[#F0FF70] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
