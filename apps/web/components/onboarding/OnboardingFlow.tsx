"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Shell } from "@/components/onboarding/Shell";
import { StepSlider } from "@/components/onboarding/StepSlider";
import { StepWorldId } from "@/components/onboarding/StepWorldId";
import { StepWallet } from "@/components/onboarding/StepWallet";
import { StepCreate } from "@/components/onboarding/StepCreate";

type Props = {
  /** e.g. `crypto-lawyer` — pre-fills create step */
  advisorTemplateId?: string | null;
};

export function OnboardingFlow({ advisorTemplateId = null }: Props) {
  const [step, setStep] = useState(0);
  const worldAdvanceRef = useRef<number | undefined>(undefined);

  const goStep = useCallback((i: number) => {
    setStep(Math.max(0, Math.min(2, i)));
  }, []);

  useEffect(() => {
    return () => {
      if (worldAdvanceRef.current) clearTimeout(worldAdvanceRef.current);
    };
  }, []);

  const onWorldVerified = useCallback(() => {
    if (worldAdvanceRef.current) clearTimeout(worldAdvanceRef.current);
    worldAdvanceRef.current = window.setTimeout(() => goStep(1), 900);
  }, [goStep]);

  return (
    <Shell step={step} onStep={goStep}>
      <StepSlider step={step}>
        {[
          <StepWorldId key="w" onVerified={onWorldVerified} />,
          <StepWallet key="k" onDone={() => goStep(2)} />,
          <StepCreate key="c" advisorTemplateId={advisorTemplateId} />,
        ]}
      </StepSlider>
    </Shell>
  );
}
