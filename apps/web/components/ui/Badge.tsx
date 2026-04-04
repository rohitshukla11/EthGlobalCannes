import type { ProfessionBadgeVariant } from "@/lib/professionBadgeVariant";

type ProfessionVariant = ProfessionBadgeVariant;
type StatusVariant = "verified" | "openclaw" | "pending" | "error";
type TagVariant = "neutral";

type Props =
  | { label: string; variant: "profession"; profession: ProfessionVariant }
  | { label: string; variant: "status"; status: StatusVariant }
  | { label: string; variant: "tag"; tag?: TagVariant };

const professionStyles: Record<ProfessionVariant, string> = {
  legal: "border border-[rgba(245,158,11,0.28)] bg-[rgba(245,158,11,0.12)] text-[#FBBF24]",
  finance: "border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.1)] text-[#5EEAD4]",
  medical: "border border-[rgba(96,165,250,0.28)] bg-[rgba(96,165,250,0.1)] text-[#93C5FD]",
  web3: "border border-[rgba(56,189,248,0.28)] bg-[rgba(56,189,248,0.1)] text-[#38BDF8]",
  custom: "border border-[var(--border-1)] bg-[rgba(255,255,255,0.04)] text-[var(--text-1)]",
};

const statusStyles: Record<StatusVariant, string> = {
  verified: "border border-[rgba(74,222,128,0.28)] bg-[var(--success-dim)] text-[var(--success)]",
  openclaw: "border border-[var(--border-1)] bg-transparent text-[var(--text-2)]",
  pending: "border border-[rgba(251,211,77,0.28)] bg-[var(--pending-dim)] text-[var(--pending)]",
  error: "border border-[rgba(248,113,113,0.28)] bg-[var(--error-dim)] text-[var(--error)]",
};

export function Badge(props: Props) {
  const base =
    "inline-flex max-w-full items-center rounded-full px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]";
  if (props.variant === "profession") {
    return <span className={`${base} ${professionStyles[props.profession]}`}>{props.label}</span>;
  }
  if (props.variant === "status") {
    return <span className={`${base} ${statusStyles[props.status]}`}>{props.label}</span>;
  }
  return (
    <span className={`${base} border border-[var(--border-1)] text-[var(--text-2)]`}>{props.label}</span>
  );
}
