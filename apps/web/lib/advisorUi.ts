/** Stored slug for default demo profession — must match API `web3Architect.ts`. */
export const WEB3_ARCHITECT_PROFESSION_VALUE = "web3-architect";

/** Shared profession labels + emoji for marketplace and create flow. */
export const PROFESSION_OPTIONS = [
  { value: "web3-architect", label: "Web3 Architect", emoji: "🏗️" },
  { value: "Lawyer", label: "Lawyer", emoji: "⚖️" },
  { value: "Trader", label: "Trader", emoji: "📈" },
  { value: "Developer", label: "Developer", emoji: "💻" },
  { value: "Consultant", label: "Consultant", emoji: "📋" },
  { value: "Custom", label: "Custom", emoji: "✨" },
] as const;

export type ProfessionValue = (typeof PROFESSION_OPTIONS)[number]["value"];

/** Human-readable profession for cards and headers (handles stored slug). */
export function formatProfessionLabel(stored: string | null | undefined): string {
  const s = (stored ?? "").trim();
  if (!s) return "Advisor";
  if (s.toLowerCase() === WEB3_ARCHITECT_PROFESSION_VALUE) return "Web3 Architect";
  return s;
}

export function isWeb3ArchitectProfession(stored: string | null | undefined): boolean {
  return (stored ?? "").trim().toLowerCase() === WEB3_ARCHITECT_PROFESSION_VALUE;
}

export function professionEmoji(profession: string): string {
  const p = profession.trim().toLowerCase();
  const hit = PROFESSION_OPTIONS.find((o) => o.value.toLowerCase() === p);
  return hit?.emoji ?? "🎯";
}

export function formatConsultationPrice(
  pricing: { pricePerRequest: string; currency?: string } | null | undefined
): string {
  if (!pricing?.pricePerRequest) return "Pricing on request";
  const raw = pricing.pricePerRequest.trim();
  if (raw === "0" || raw === "") return "Free";
  try {
    const n = BigInt(raw);
    if (n === BigInt(0)) return "Free";
    const eth = Number(n) / 1e18;
    if (Number.isFinite(eth) && eth > 0 && eth < 1e6) {
      const s = eth >= 0.001 ? eth.toFixed(eth >= 1 ? 2 : 4) : eth.toExponential(2);
      return `${s} ETH / consultation`;
    }
    return `${raw} wei / consultation`;
  } catch {
    return `${raw} / consultation`;
  }
}
