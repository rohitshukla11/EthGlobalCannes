"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { OnboardingSidebar } from "@/components/onboarding/OnboardingSidebar";
import { ProgressBar } from "@/components/onboarding/ProgressBar";

type Props = {
  step: number;
  onStep: (i: number) => void;
  children: ReactNode;
};

export function Shell({ step, onStep, children }: Props) {
  return (
    <div className="fixed inset-0 z-0 flex h-[100dvh] w-full bg-void text-primary">
      <OnboardingSidebar step={step} onStep={onStep} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-dim px-6 py-5 md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent">Counselr</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight text-primary md:text-3xl">
            Create your AI advisor
          </h1>
          <p className="mt-2 max-w-xl font-mono text-[13px] leading-relaxed text-secondary">
            AI advisors powered by real professionals — turn your expertise into an AI that people can consult.
          </p>
        </header>
        <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
        <div className="flex shrink-0 items-center justify-center gap-6 border-t border-dim bg-void px-4 py-3 font-mono text-[11px]">
          <Link
            href="/marketplace"
            className="text-secondary no-underline transition-colors hover:text-accent"
          >
            Explore Advisors
          </Link>
          <span className="text-tertiary" aria-hidden>
            ·
          </span>
          <Link href="/console" className="text-secondary no-underline transition-colors hover:text-accent">
            Console
          </Link>
        </div>
        <ProgressBar step={step} />
      </div>
    </div>
  );
}
