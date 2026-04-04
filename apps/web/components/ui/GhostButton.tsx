"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

type Size = "sm" | "md";

const heights: Record<Size, string> = {
  sm: "h-8 text-[12px]",
  md: "h-9 text-[13px]",
};

type Props = {
  label: string;
  onClick?: () => void;
  icon?: ReactNode;
  size?: Size;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
};

export function GhostButton({
  label,
  onClick,
  icon,
  size = "md",
  className = "",
  type = "button",
  disabled,
}: Props) {
  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.08, ease: "easeOut" }}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border-2)] font-mono font-normal text-[var(--text-1)] transition-colors duration-150 hover:border-[var(--border-3)] hover:text-[var(--text-0)] disabled:cursor-not-allowed disabled:opacity-40 ${heights[size]} w-full ${className}`}
    >
      {icon}
      {label}
    </motion.button>
  );
}
