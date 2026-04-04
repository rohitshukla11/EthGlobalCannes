"use client";

import { Bot, Home, Sparkles, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo } from "react";
import { OnboardingLog } from "@/components/onboarding/OnboardingLog";

type Props = {
  step: number;
  onStep: (i: number) => void;
};

export const OnboardingSidebar = memo(function OnboardingSidebar({ step, onStep }: Props) {
  const pathname = usePathname();
  const exploreActive = pathname === "/marketplace" || pathname.startsWith("/agent/");

  const items: { i: number; icon: typeof Home; label: string }[] = [
    { i: 0, icon: Home, label: "Identity" },
    { i: 1, icon: Wallet, label: "Wallet" },
    { i: 2, icon: Sparkles, label: "Create advisor" },
  ];

  return (
    <aside className="flex w-sidebar shrink-0 flex-col border-r border-dim bg-void">
      <div className="flex justify-center pt-5">
        <Link
          href="/"
          className="flex size-9 items-center justify-center rounded-ui border border-mid font-mono text-[11px] text-accent no-underline"
          aria-label="Counselr home"
        >
          CR
        </Link>
      </div>
      <nav className="mt-8 flex flex-col gap-1 px-3.5" aria-label="Onboarding steps">
        {items.map(({ i, icon: Icon, label }) => {
          const active = step === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onStep(i)}
              aria-label={label}
              aria-current={active ? "step" : undefined}
              className={`relative flex size-9 items-center justify-center rounded-ui border border-transparent transition-colors duration-200 ${
                active ? "bg-[rgba(232,255,90,0.08)]" : "hover:bg-overlay"
              }`}
            >
              {active ? (
                <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-accent" aria-hidden />
              ) : null}
              <Icon
                className="size-4"
                strokeWidth={1.5}
                stroke={active ? "#E8FF5A" : "rgba(255,255,255,0.3)"}
                aria-hidden
              />
            </button>
          );
        })}
        <Link
          href="/marketplace"
          aria-label="Explore Advisors"
          aria-current={exploreActive ? "page" : undefined}
          className={`relative mt-3 flex size-9 items-center justify-center rounded-ui border border-transparent transition-colors duration-200 ${
            exploreActive ? "bg-[rgba(232,255,90,0.08)]" : "hover:bg-overlay"
          }`}
        >
          {exploreActive ? (
            <span className="absolute bottom-1 left-0 top-1 w-0.5 rounded-full bg-accent" aria-hidden />
          ) : null}
          <Bot
            className="size-4"
            strokeWidth={1.5}
            stroke={exploreActive ? "#E8FF5A" : "rgba(255,255,255,0.3)"}
            aria-hidden
          />
        </Link>
      </nav>
      <div className="mt-auto min-h-0">
        <OnboardingLog />
      </div>
    </aside>
  );
});
