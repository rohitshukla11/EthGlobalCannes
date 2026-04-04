import type { LucideIcon } from "lucide-react";
import { LayoutGrid, Sparkles } from "lucide-react";

export type AppNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const APP_NAV_AGENTS: AppNavItem[] = [
  { label: "Create Advisor", href: "/", icon: Sparkles },
  { label: "Explore Advisors", href: "/marketplace", icon: LayoutGrid },
];
