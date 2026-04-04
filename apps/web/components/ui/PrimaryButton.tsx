"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Props = {
  label: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  type?: "button" | "submit";
};

export function PrimaryButton({
  label,
  onClick,
  loading,
  disabled,
  icon,
  className = "",
  type = "button",
}: Props) {
  const off = disabled || loading;
  return (
    <motion.button
      type={type}
      disabled={off}
      onClick={onClick}
      whileTap={off ? undefined : { scale: 0.99 }}
      transition={{ duration: 0.08, ease: "easeOut" }}
      className={`inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] font-mono text-[13px] font-medium uppercase tracking-[0.1em] transition-colors duration-150 ${
        off
          ? "cursor-not-allowed bg-[var(--bg-3)] text-[var(--text-2)]"
          : "bg-[var(--accent)] text-[var(--bg-0)] hover:brightness-105"
      } ${className}`}
    >
      {loading ? (
        <svg className="spinner-700 size-4 text-[var(--bg-0)]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="31 40"
            strokeLinecap="round"
          />
        </svg>
      ) : null}
      {icon}
      {label}
    </motion.button>
  );
}
