"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ProfessionGlyph } from "@/components/ui/ProfessionGlyph";
import { formatProfessionLabel } from "@/lib/advisorUi";
import { professionBadgeVariant } from "@/lib/professionBadgeVariant";

export type AdvisorMarketplaceCardProps = {
  variant?: "grid" | "featured";
  name: string;
  profession: string;
  specialization: string;
  experience: string;
  pitch: string;
  verified?: boolean;
  priceLabel: string;
  isFree: boolean;
  consultHref?: string;
  profileHref?: string;
  preview?: boolean;
};

export function AdvisorMarketplaceCard({
  variant = "grid",
  name,
  profession,
  specialization,
  experience,
  pitch,
  verified,
  priceLabel,
  isFree,
  consultHref,
  profileHref,
  preview,
}: AdvisorMarketplaceCardProps) {
  const profLabel = formatProfessionLabel(profession);
  const badgeVar = professionBadgeVariant(profession);
  const topBorder = variant === "featured" ? "border-t border-[var(--accent)]" : "";

  const inner = (
    <>
      <div className="flex items-start gap-3">
        <ProfessionGlyph profession={profession} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3
              className={`truncate font-mono text-sm font-medium ${
                preview && !name.trim() ? "text-[var(--text-3)]" : "text-[var(--text-0)]"
              }`}
            >
              {name.trim() || "Display name"}
            </h3>
            <span
              className={`shrink-0 font-mono text-[13px] font-medium ${isFree ? "text-[var(--success)]" : "text-[var(--accent)]"}`}
            >
              {priceLabel}
            </span>
          </div>
          <div className="mt-2">
            <Badge variant="profession" profession={badgeVar} label={profLabel} />
          </div>
        </div>
      </div>

      <div className="my-3 h-px bg-[var(--border-0)]" />

      <p
        className={`font-mono text-xs font-normal ${
          preview && !specialization.trim() ? "text-[var(--text-3)]" : "text-[var(--text-1)]"
        }`}
      >
        {specialization.trim() || "Specialization"}
      </p>
      <p
        className={`mt-2 font-mono text-[11px] font-light ${
          preview && !experience.trim() ? "text-[var(--text-3)]" : "text-[var(--text-2)]"
        }`}
      >
        {experience.trim() || "Years, credentials, context"}
        {verified ? (
          <span className="ml-2 font-mono text-[10px] font-normal text-[var(--success)]">● VERIFIED</span>
        ) : null}
      </p>

      <blockquote
        className={`my-2.5 border-l-2 border-[var(--border-2)] pl-2.5 font-mono text-xs font-light italic ${
          preview && !pitch.trim() ? "text-[var(--text-3)]" : "text-[var(--text-1)]"
        }`}
      >
        {pitch.trim() ? `“${pitch}”` : "In one sentence, what makes you the expert…"}
      </blockquote>

      <div className="mt-4 flex gap-2">
        {preview || !consultHref ? (
          <span className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-3)] font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-2)]">
            CONSULT →
          </span>
        ) : (
          <Link
            href={consultHref}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--accent)] font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--bg-0)] no-underline transition-colors hover:brightness-105"
          >
            CONSULT →
          </Link>
        )}
        {preview || !profileHref ? (
          <span className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-2)] font-mono text-[11px] font-normal text-[var(--text-2)]">
            Profile
          </span>
        ) : (
          <Link
            href={profileHref}
            className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--border-2)] font-mono text-[11px] font-normal text-[var(--text-1)] no-underline transition-colors hover:border-[var(--border-3)] hover:text-[var(--text-0)]"
          >
            Profile
          </Link>
        )}
      </div>
    </>
  );

  return (
    <article
      className={`flex h-full flex-col rounded-[var(--radius-md)] border border-[var(--border-1)] bg-[var(--bg-1)] p-5 transition-[border-color,transform] duration-150 ease-out hover:-translate-y-px hover:border-[var(--border-2)] ${topBorder} ${preview ? "cursor-default" : "cursor-pointer"}`}
    >
      {inner}
    </article>
  );
}
