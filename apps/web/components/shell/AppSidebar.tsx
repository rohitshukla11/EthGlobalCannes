"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive } from "@/lib/navActive";
import { APP_NAV_AGENTS, APP_NAV_MORE, type AppNavItem } from "@/components/shell/appNavConfig";

function NavRow({ item, active }: { item: AppNavItem; active: boolean }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`relative flex items-center gap-3 rounded-ui border px-3 py-2.5 font-mono text-[12px] no-underline transition-colors duration-200 ${
        active
          ? "border-[rgba(232,255,90,0.45)] bg-[rgba(232,255,90,0.08)] text-accent"
          : "border-transparent text-secondary hover:border-mid hover:bg-overlay hover:text-primary"
      }`}
      aria-current={active ? "page" : undefined}
    >
      {active ? (
        <span
          className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-accent"
          aria-hidden
        />
      ) : null}
      <Icon
        className="size-4 shrink-0"
        strokeWidth={1.5}
        stroke={active ? "#E8FF5A" : "rgba(255,255,255,0.35)"}
        aria-hidden
      />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
}

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex w-[200px] shrink-0 flex-col border-r border-dim bg-void"
      aria-label="App navigation"
    >
      <div className="flex justify-center pt-5">
        <Link
          href="/"
          className="flex size-9 items-center justify-center rounded-ui border border-mid font-mono text-[11px] text-accent no-underline transition-colors hover:border-accent"
          aria-label="Counselr home"
        >
          CR
        </Link>
      </div>

      <nav className="mt-8 flex flex-col gap-1 px-3">
        <p className="mb-1 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-tertiary">Agents</p>
        {APP_NAV_AGENTS.map((item) => (
          <NavRow key={item.href} item={item} active={isNavActive(pathname, item.href)} />
        ))}

        <div className="my-4 h-px bg-dim" role="separator" aria-hidden />

        <p className="mb-1 px-3 font-mono text-[9px] uppercase tracking-[0.14em] text-tertiary">Network</p>
        {APP_NAV_MORE.map((item) => (
          <NavRow key={item.href} item={item} active={isNavActive(pathname, item.href)} />
        ))}

        <div className="my-4 h-px bg-dim" role="separator" aria-hidden />

        <Link
          href="/"
          className="rounded-ui border border-transparent px-3 py-2 font-mono text-[11px] text-tertiary no-underline transition-colors hover:border-mid hover:bg-overlay hover:text-secondary"
        >
          ← Onboarding
        </Link>
      </nav>
    </aside>
  );
}
