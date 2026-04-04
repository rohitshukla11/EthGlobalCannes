"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/shell/AppSidebar";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/") {
    return <>{children}</>;
  }
  return (
    <div className="flex min-h-screen bg-void text-primary">
      <AppSidebar />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-10">{children}</div>
    </div>
  );
}
