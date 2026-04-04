"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/shell/AppSidebar";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onboardPad = pathname === "/" ? "pb-14" : "";

  return (
    <div className="flex min-h-screen bg-[var(--bg-0)] text-[var(--text-0)]">
      <AppSidebar />
      <main
        className={`relative min-h-screen min-w-0 flex-1 overflow-y-auto border-l border-[var(--border-0)] px-14 pb-12 pt-12 ${onboardPad}`}
      >
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mx-auto max-w-[1200px]"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
