import { Suspense } from "react";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

function HomeFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center font-mono text-[13px] text-tertiary">
      Loading…
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const sp = await searchParams;
  return (
    <Suspense fallback={<HomeFallback />}>
      <OnboardingFlow advisorTemplateId={sp.template?.trim() || null} />
    </Suspense>
  );
}
