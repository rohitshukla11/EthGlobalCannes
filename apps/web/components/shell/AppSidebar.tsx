"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { isNavActive } from "@/lib/navActive";

function truncateAddr(a: string): string {
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type NavItem = { href: string; label: string; sym: string };

const AGENTS: NavItem[] = [
  { href: "/", label: "Create Advisor", sym: "✦" },
  { href: "/marketplace", label: "Explore Advisors", sym: "⊞" },
];

function NavRow({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      href={item.href}
      className={`relative flex h-9 items-center gap-2.5 px-5 font-mono text-[13px] font-normal no-underline transition-colors duration-150 ${
        active
          ? "bg-[var(--bg-2)] text-[var(--text-0)]"
          : "text-[var(--text-1)] hover:bg-[var(--bg-3)] hover:text-[var(--text-0)]"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--accent)]" aria-hidden />
      ) : null}
      <span className="w-5 shrink-0 text-center font-mono text-[12px] text-[var(--text-2)]" aria-hidden>
        {item.sym}
      </span>
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const { address, isConnected } = useAccount();

  return (
    <aside
      className="flex h-screen w-[var(--sidebar-w)] shrink-0 flex-col border-r border-[var(--border-0)] bg-[var(--bg-0)]"
      aria-label="App navigation"
    >
      <div className="pt-5">
        <Link
          href="/"
          className="mx-4 mb-8 flex items-center gap-3 no-underline"
          aria-label="Alter home"
        >
          <span className="flex size-7 items-center justify-center rounded-[5px] border border-[var(--border-2)] font-mono text-[13px] font-medium text-[var(--accent)]">
            A
          </span>
          <span className="font-mono text-[13px] font-medium text-[var(--text-0)]">Alter</span>
        </Link>

        <p className="mb-1.5 px-5 font-mono text-[10px] font-normal uppercase tracking-[0.1em] text-[var(--text-2)]">
          AGENTS
        </p>
        <nav className="flex flex-col">
          {AGENTS.map((item) => (
            <NavRow key={item.href} item={item} active={isNavActive(pathname, item.href)} />
          ))}
        </nav>
      </div>

      <div className="mt-auto flex flex-col pb-5">
        <Link
          href="/"
          className="px-5 py-2 font-mono text-[13px] font-normal text-[var(--text-2)] no-underline transition-colors hover:text-[var(--text-1)]"
        >
          ← Onboarding
        </Link>
        <div className="mx-4 mt-2 flex items-center gap-2 border-t border-[var(--border-0)] pt-4 font-mono text-[11px] text-[var(--text-2)]">
          <span
            className={`size-2 shrink-0 rounded-full ${isConnected ? "bg-[var(--success)]" : "bg-[var(--text-3)]"}`}
            aria-hidden
          />
          <span className="min-w-0 truncate">
            {isConnected && address ? truncateAddr(address) : "No wallet"}
          </span>
        </div>
      </div>
    </aside>
  );
}
