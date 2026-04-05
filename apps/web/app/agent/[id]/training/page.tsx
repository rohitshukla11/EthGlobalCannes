"use client";

import { Instrument_Serif } from "next/font/google";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiBase } from "@/lib/api";
import type { TrainingDocument } from "@/lib/agentTypes";
import { shortenRoot } from "@/lib/formatRoot";

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  style: ["italic"],
});

type Manifest = {
  type: string;
  agent: string;
  docCount: number;
  totalSizeBytes: number;
  documents: Array<{
    filename: string;
    hash: string;
    sizeBytes: number;
    uploadedAt: number;
    description?: string;
  }>;
  manifestHash: string;
  createdAt: number;
};

function mimeBadge(mimeHint: string): { label: string; className: string } {
  const lower = mimeHint.toLowerCase();
  if (lower.endsWith(".pdf")) return { label: "PDF", className: "bg-red-500/20 text-red-300 border-red-500/35" };
  if (lower.endsWith(".md")) return { label: "MD", className: "bg-violet-500/15 text-violet-200 border-violet-500/30" };
  if (lower.endsWith(".docx")) return { label: "DOCX", className: "bg-blue-500/15 text-blue-200 border-blue-500/30" };
  return { label: "TXT", className: "bg-sky-500/15 text-sky-200 border-sky-500/30" };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

type TrainingVerifyResponse = {
  reachable?: boolean;
  integrityOk?: boolean;
  byteLength?: number;
  expectedSizeBytes?: number;
  verifiedAt?: string;
  explorerUrl?: string;
  summary?: string;
  error?: string;
};

type VerifyState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "done";
      reachable: boolean;
      integrityOk: boolean;
      byteLength: number;
      expectedSizeBytes: number;
      verifiedAt: string;
      explorerUrl?: string;
      summary?: string;
    }
  | { status: "error"; message: string };

function DocVerifyRow({ agentId, doc }: { agentId: string; doc: TrainingDocument }) {
  const [v, setV] = useState<VerifyState>({ status: "idle" });

  async function verify() {
    setV({ status: "loading" });
    try {
      const r = await fetch(
        `${apiBase}/agents/${encodeURIComponent(agentId)}/training/verify/${encodeURIComponent(doc.id)}`,
        { cache: "no-store" }
      );
      const j = (await r.json()) as TrainingVerifyResponse;
      if (!r.ok) {
        setV({ status: "error", message: j.error ?? `HTTP ${r.status}` });
        return;
      }
      setV({
        status: "done",
        reachable: Boolean(j.reachable),
        integrityOk: Boolean(j.integrityOk),
        byteLength: j.byteLength ?? 0,
        expectedSizeBytes: j.expectedSizeBytes ?? doc.sizeBytes,
        verifiedAt: j.verifiedAt ?? new Date().toISOString(),
        explorerUrl: j.explorerUrl,
        summary: j.summary,
      });
    } catch (e) {
      setV({ status: "error", message: String(e) });
    }
  }

  return (
    <div className="mt-2 space-y-1.5 rounded border border-dim bg-black/20 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => verify()}
          disabled={v.status === "loading"}
          className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent hover:underline disabled:opacity-50"
        >
          {v.status === "loading" ? "Verifying…" : "Verify on 0G (API)"}
        </button>
        {v.status === "done" && v.reachable && v.integrityOk ? (
          <span className="font-mono text-[10px] text-success">
            ✓ Downloaded from 0G · {new Date(v.verifiedAt).toISOString().slice(11, 19)} UTC · {v.byteLength} bytes
          </span>
        ) : null}
        {v.status === "done" && v.reachable && !v.integrityOk ? (
          <span className="font-mono text-[10px] text-pending">
            ⚠ Reachable but size mismatch: got {v.byteLength} B, expected {v.expectedSizeBytes} B
          </span>
        ) : null}
        {v.status === "done" && !v.reachable ? (
          <span className="font-mono text-[10px] text-error">✗ Not retrievable from 0G for this root</span>
        ) : null}
        {v.status === "error" ? <span className="font-mono text-[10px] text-error">{v.message}</span> : null}
      </div>
      {v.status === "done" && v.summary ? (
        <p className="font-mono text-[10px] leading-relaxed text-tertiary">{v.summary}</p>
      ) : null}
      {v.status === "done" && v.explorerUrl ? (
        <a
          href={v.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-block font-mono text-[10px] text-accent no-underline hover:underline"
        >
          Open blob on StorageScan ↗
        </a>
      ) : null}
    </div>
  );
}

export default function TrainingDataPage() {
  const params = useParams();
  const rawId = typeof params?.id === "string" ? params.id : "";
  const id = decodeURIComponent(rawId);

  const [name, setName] = useState("");
  const [ens, setEns] = useState("");
  const [docs, setDocs] = useState<TrainingDocument[]>([]);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [trainingRoot, setTrainingRoot] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  /** 0G StorageScan (Galileo) — blob roots use /submission/0x…, not ChainScan /storage/. */
  const [storageScan, setStorageScan] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setErr(null);
    try {
      const enc = encodeURIComponent(id);
      const [agentRes, trainRes, pub] = await Promise.all([
        fetch(`${apiBase}/agents/${enc}`, { cache: "no-store" }),
        fetch(`${apiBase}/agents/${enc}/training`, { cache: "no-store" }),
        fetch(`${apiBase}/config/public`, { cache: "no-store" }),
      ]);
      if (!agentRes.ok) throw new Error(await agentRes.text());
      const aj = (await agentRes.json()) as { agent: { name: string; ensFullName: string } };
      setName(aj.agent.name);
      setEns(aj.agent.ensFullName);
      if (!trainRes.ok) throw new Error(await trainRes.text());
      const tj = (await trainRes.json()) as {
        docs: TrainingDocument[];
        manifest: Manifest | null;
        trainingRoot?: string;
        updatedAt?: number;
      };
      setDocs(tj.docs ?? []);
      setManifest(tj.manifest);
      setTrainingRoot(tj.trainingRoot ?? null);
      setUpdatedAt(tj.updatedAt ?? null);
      if (pub.ok) {
        const pj = (await pub.json()) as { zgStorageScanUrl?: string };
        setStorageScan(
          (pj.zgStorageScanUrl ?? "https://storagescan-galileo.0g.ai").replace(/\/$/, ""),
        );
      }
    } catch (e) {
      setErr(String(e));
    }
  }, [id]);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const totalBytes = manifest?.totalSizeBytes ?? docs.reduce((s, d) => s + d.sizeBytes, 0);
  const nDocs = manifest?.docCount ?? docs.length;
  const listDocs = manifest?.documents?.length ? manifest.documents : docs;

  if (err) {
    return (
      <div className="rounded-ui border border-error/40 bg-raised p-8 font-mono text-[13px] text-error">
        {err}
        <Link href="/marketplace" className="mt-4 block text-secondary no-underline hover:text-primary">
          ← Explore Advisors
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="font-mono text-[13px]">
        <Link href={`/agent/${encodeURIComponent(id)}`} className="text-tertiary no-underline hover:text-secondary">
          ← Profile
        </Link>
      </div>

      <header>
        <p className="font-mono text-[11px] text-secondary">{name}</p>
        <p className="mt-1 font-mono text-[12px] text-accent">{ens}</p>
        <h1 className={`${instrumentSerif.className} mt-4 text-3xl text-primary sm:text-4xl`}>Training corpus</h1>
        <p className="mt-3 max-w-subtitle font-mono text-[13px] leading-relaxed text-secondary">
          Every document this advisor was trained on. Each hash is verifiable on 0G Storage.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-ui border border-dim bg-raised p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Documents</p>
          <p className="mt-2 font-mono text-2xl text-primary">{nDocs}</p>
        </div>
        <div className="rounded-ui border border-dim bg-raised p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Total size</p>
          <p className="mt-2 font-mono text-2xl text-primary">{formatBytes(totalBytes)}</p>
        </div>
        <div className="rounded-ui border border-dim bg-raised p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-tertiary">Updated</p>
          <p className="mt-2 font-mono text-[13px] text-primary">
            {updatedAt ? new Date(updatedAt).toISOString().slice(0, 10) : "—"}
          </p>
        </div>
      </div>

      <section className="rounded-ui border border-dim bg-raised p-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-tertiary">Manifest root — 0G storage</p>
        {trainingRoot ? (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all font-mono text-[11px] text-secondary">{trainingRoot}</code>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(trainingRoot)}
                className="shrink-0 rounded border border-mid px-2 py-0.5 font-mono text-[10px] text-tertiary hover:text-primary"
              >
                Copy
              </button>
            </div>
            <p className="mt-3 font-mono text-[11px] text-tertiary">
              Resolves from ENS: <span className="text-secondary">alter.trainingRoot</span> on {ens}
            </p>
            {storageScan ? (
              <a
                href={`${storageScan}/submission/${trainingRoot.startsWith("0x") ? trainingRoot : `0x${trainingRoot}`}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block font-mono text-[11px] text-accent no-underline hover:underline"
              >
                View on StorageScan ↗
              </a>
            ) : null}
          </>
        ) : (
          <p className="mt-2 font-mono text-[12px] text-tertiary">No manifest published yet.</p>
        )}
      </section>

      <section>
        <h2 className="type-eyebrow mb-4">Documents</h2>
        {!listDocs.length ? (
          <p className="font-mono text-[13px] text-tertiary">This advisor hasn&apos;t uploaded training documents yet.</p>
        ) : (
          <ul className="space-y-3">
            {listDocs.map((row) => {
              const dbDoc = docs.find((d) => d.filename === row.filename);
              const badge = mimeBadge(row.filename);
              return (
                <li key={row.filename} className="rounded-ui border border-dim bg-black/30 p-4">
                  <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase ${badge.className}`}>
                      {badge.label}
                    </span>
                    <span className="text-primary">{row.filename}</span>
                    <span className="text-tertiary">{formatBytes(row.sizeBytes)}</span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(row.hash)}
                      className="break-all text-tertiary hover:text-accent"
                      title="Copy hash"
                    >
                      {shortenRoot(row.hash, 6, 4)}
                    </button>
                    {storageScan ? (
                      <a
                        href={`${storageScan}/submission/${row.hash.startsWith("0x") ? row.hash : `0x${row.hash}`}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        StorageScan ↗
                      </a>
                    ) : null}
                  </div>
                  {row.description ? <p className="mt-2 font-mono text-[10px] text-tertiary">{row.description}</p> : null}
                  {dbDoc ? (
                    <div className="mt-2">
                      <DocVerifyRow agentId={id} doc={dbDoc} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
