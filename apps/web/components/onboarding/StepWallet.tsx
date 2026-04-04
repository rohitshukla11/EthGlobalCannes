"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Wallet } from "lucide-react";
import { useAccount, useConnect, useChainId, useSwitchChain } from "wagmi";
import { zgGalileoTestnet } from "@/lib/wagmi";
import { formatEthAddress } from "@/lib/formatAddress";
import { getStoredToken } from "@/lib/session";
import { apiPost } from "@/lib/api";
import { sleep } from "@/lib/sleep";
import { HexHoneycomb } from "@/components/onboarding/HexHoneycomb";
import { useCommandLog } from "@/components/command-log/CommandLogProvider";

type Props = {
  onDone: () => void;
};

export function StepWallet({ onDone }: Props) {
  const { push } = useCommandLog();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const [displayed, setDisplayed] = useState("");
  const [typing, setTyping] = useState(false);
  const advancedRef = useRef(false);

  const injected = connectors.find((c) => c.type === "injected") ?? connectors[0];
  const onCorrectNetwork = chainId === zgGalileoTestnet.id;
  const connectedOk = isConnected && address && onCorrectNetwork;

  const typeAddress = useCallback(async (addr: string) => {
    setTyping(true);
    setDisplayed("");
    for (let i = 0; i <= addr.length; i++) {
      setDisplayed(addr.slice(0, i));
      await sleep(28);
    }
    setTyping(false);
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setDisplayed("");
      advancedRef.current = false;
      return;
    }
    void typeAddress(formatEthAddress(address));
  }, [isConnected, address, typeAddress]);

  useEffect(() => {
    if (!connectedOk || typing || advancedRef.current) return;

    const ctrl = new AbortController();

    (async () => {
      const tok = getStoredToken();
      if (tok && address) {
        try {
          await apiPost("/session/wallet", { wallet: address }, tok);
          push({
            level: "success",
            event: "WALLET",
            value: `${address.slice(0, 6)}...${address.slice(-4)}`,
          });
        } catch {
          push({ level: "error", event: "WALLET", value: "session link failed" });
        }
      }
      await sleep(800);
      if (ctrl.signal.aborted) return;
      advancedRef.current = true;
      onDone();
    })();

    return () => ctrl.abort();
  }, [connectedOk, typing, address, onDone, push]);

  const short =
    displayed.length === 42 && displayed.startsWith("0x")
      ? `${displayed.slice(0, 6)}...${displayed.slice(-4)}`
      : displayed;

  return (
    <div className="flex min-h-full w-full flex-col items-center justify-center gap-12 px-0 md:flex-row md:gap-20">
      <div className="w-full min-w-0 flex-[1.1] md:max-w-[55%]">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">02 — WALLET</p>
        <h2 className="mt-3 font-display text-[40px] font-extrabold leading-none text-primary">
          Connect your
          <br />
          <span className="text-accent">wallet</span>
        </h2>
        <p className="mt-5 max-w-[340px] font-mono text-[13px] leading-relaxed text-secondary">
          Link the wallet that will own your Persona on 0G Galileo. Same address as your Sepolia ENS when you mint.
        </p>

        <div className="mt-8 rounded-[var(--radius-sm)] border border-[var(--border-1)] bg-[var(--bg-1)] px-4 py-3.5 font-mono text-[13px]">
          {!isConnected ? (
            <p className="flex items-center gap-2 text-[var(--text-2)]">
              <span className="size-2 shrink-0 rounded-full bg-[var(--text-3)]" aria-hidden />
              No wallet connected
            </p>
          ) : typing ? (
            <p className="flex items-center gap-2 text-[var(--text-0)]">
              <span className="size-2 shrink-0 animate-pulse rounded-full bg-[var(--pending)]" aria-hidden />
              <span>{short}</span>
              <span className="cursor-blink text-[var(--accent)]" aria-hidden>
                ▊
              </span>
            </p>
          ) : connectedOk ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[var(--text-0)]">
                <span className="size-2 shrink-0 rounded-full bg-[var(--success)]" aria-hidden />
                {short}
              </p>
              <span className="rounded-[var(--radius-sm)] border border-[var(--border-1)] px-[7px] py-0.5 font-mono text-[10px] font-normal text-[var(--text-2)]">
                GALILEO
              </span>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-[var(--pending)]">
              <span className="size-2 shrink-0 rounded-full bg-[var(--pending)]" aria-hidden />
              Wrong network — switch to 0G Galileo
            </p>
          )}
        </div>

        {isConnected && !onCorrectNetwork ? (
          <button
            type="button"
            disabled={switching}
            onClick={() => switchChain({ chainId: zgGalileoTestnet.id })}
            className="mt-3 font-mono text-[12px] text-secondary underline decoration-mid underline-offset-2 hover:text-primary disabled:opacity-50"
          >
            {switching ? "Switching…" : "Switch network in wallet"}
          </button>
        ) : null}

        <motion.button
          type="button"
          disabled={!injected || isPending || Boolean(connectedOk)}
          onClick={() => injected && connect({ connector: injected, chainId: zgGalileoTestnet.id })}
          whileHover={connectedOk ? undefined : { y: -2 }}
          whileTap={connectedOk ? undefined : { scale: 0.97 }}
          className={`mt-6 inline-flex h-11 items-center gap-2 rounded-control px-7 font-mono text-[12px] font-medium tracking-[0.08em] transition-colors ${
            connectedOk
              ? "pointer-events-none cursor-default border border-[rgba(74,222,128,0.3)] bg-[rgba(74,222,128,0.1)] text-success"
              : "bg-accent text-void hover:bg-[#F0FF70] disabled:opacity-40"
          }`}
          aria-label="Connect MetaMask"
        >
          <Wallet className="size-4 stroke-[2] text-current" aria-hidden />
          {connectedOk ? "CONNECTED ✓" : isPending ? "OPENING…" : "CONNECT METAMASK"}
        </motion.button>
      </div>
      <div className="flex w-full flex-1 justify-center md:max-w-[45%]">
        <HexHoneycomb connected={Boolean(connectedOk)} />
      </div>
    </div>
  );
}
