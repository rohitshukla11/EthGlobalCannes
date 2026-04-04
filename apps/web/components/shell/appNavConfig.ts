import type { LucideIcon } from "lucide-react";
import { BadgeCheck, GitBranch, LayoutGrid, Sparkles, Terminal } from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const APP_NAV_AGENTS: AppNavItem[] = [
  { label: "Create Advisor", href: "/", icon: Sparkles },
  { label: "Explore Advisors", href: "/marketplace", icon: LayoutGrid },
  { label: "Console", href: "/console", icon: Terminal },
];

export const APP_NAV_MORE: AppNavItem[] = [
  { label: "Chain", href: "/chain", icon: GitBranch },
  { label: "Verify", href: "/verify", icon: BadgeCheck },
];
