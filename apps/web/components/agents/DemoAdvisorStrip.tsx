"use client";

import Link from "next/link";
import { DEMO_ADVISOR_TEMPLATES } from "@/lib/demoAdvisorTemplates";
import { professionEmoji } from "@/lib/advisorUi";

export function DemoAdvisorStrip() {
  return (
    <section className="mb-12 rounded-ui border border-dim bg-[rgba(17,17,16,0.55)] p-6 backdrop-blur-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">Demo mode</p>
          <h2 className="mt-1 font-display text-xl font-extrabold text-primary">Featured example advisors</h2>
          <p className="mt-2 max-w-xl font-mono text-[12px] leading-relaxed text-secondary">
            Positioning samples for your hackathon story. Use a template to pre-fill create — you still mint your own ENS and
            iNFT to go live.
          </p>
        </div>
      </div>
      <ul className="mt-6 grid gap-4 sm:grid-cols-3">
        {DEMO_ADVISOR_TEMPLATES.map((d) => (
          <li
            key={d.id}
            className="flex flex-col rounded-control border border-mid bg-black/30 p-4 transition-colors hover:border-[rgba(232,255,90,0.25)]"
          >
            <p className="font-mono text-[13px] font-medium text-primary">
              <span className="mr-1.5" aria-hidden>
                {professionEmoji(d.profession)}
              </span>
              {d.profession}
            </p>
            <p className="mt-2 font-mono text-[12px] text-secondary">{d.specialization}</p>
            <p className="mt-2 line-clamp-2 font-mono text-[11px] leading-relaxed text-tertiary">{d.experience}</p>
            <p className="mt-3 line-clamp-2 font-mono text-[11px] italic text-secondary">&ldquo;{d.pitch}&rdquo;</p>
            <Link
              href={`/?template=${encodeURIComponent(d.id)}`}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-control border border-accent/40 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-accent no-underline transition-colors hover:bg-[rgba(232,255,90,0.08)]"
            >
              Use template
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
