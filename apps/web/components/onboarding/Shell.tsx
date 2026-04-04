"use client";

import type { ReactNode } from "react";
import { ProgressBar } from "@/components/onboarding/ProgressBar";

type Props = {
  step: number;
  children: ReactNode;
};

export function Shell({ step, children }: Props) {
  return (
    <>
      {children}
      <ProgressBar step={step} />
    </>
  );
}
