"use client";

import { useCallback, useState } from "react";

export type DownloadStatus = "idle" | "checking" | "downloading" | "done" | "error";

export interface UseDownloadFileInfo {
  size: number;
  finalized: boolean;
  pruned: boolean;
}

interface InfoResponseOk {
  fileInfo: UseDownloadFileInfo | null;
  error?: undefined;
}

interface InfoResponseErr {
  error: string;
  fileInfo?: undefined;
}

function apiPath(path: string): string {
  if (typeof window !== "undefined") return path;
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.VERCEL_URL?.replace(/\/$/, "") ??
    "";
  if (!base) return path;
  const origin = base.startsWith("http") ? base : `https://${base}`;
  return `${origin}${path}`;
}

/**
 * Client hook: loads metadata via GET `/api/storage/download` and bytes via POST (SDK runs server-side only).
 */
export function useDownload(): {
  download: (rootHash: string) => Promise<string | object | Blob>;
  status: DownloadStatus;
  fileInfo: { size: number; finalized: boolean } | null;
  error: string | null;
} {
  const [status, setStatus] = useState<DownloadStatus>("idle");
  const [fileInfo, setFileInfo] = useState<{ size: number; finalized: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = useCallback(async (rootHash: string) => {
    setError(null);
    setFileInfo(null);

    try {
      setStatus("checking");
      const infoRes = await fetch(
        `${apiPath("/api/storage/download")}?rootHash=${encodeURIComponent(rootHash)}`,
        { method: "GET", headers: { Accept: "application/json" } }
      );
      const infoJson = (await infoRes.json()) as InfoResponseOk | InfoResponseErr;

      if (!infoRes.ok && "error" in infoJson && typeof infoJson.error === "string") {
        throw new Error(infoJson.error);
      }

      if ("error" in infoJson && typeof infoJson.error === "string") {
        throw new Error(infoJson.error);
      }

      const ok = infoJson as InfoResponseOk;
      if (ok.fileInfo === null) {
        throw new Error("File not found");
      }

      if (ok.fileInfo.pruned) {
        throw new Error("File has been pruned");
      }
      if (!ok.fileInfo.finalized) {
        throw new Error("File not finalized");
      }

      setFileInfo({ size: ok.fileInfo.size, finalized: ok.fileInfo.finalized });

      setStatus("downloading");
      const postRes = await fetch(apiPath("/api/storage/download"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "*/*" },
        body: JSON.stringify({ rootHash }),
      });

      const ct = postRes.headers.get("Content-Type") ?? "";

      if (!postRes.ok) {
        const errJson = (await postRes.json().catch(() => null)) as { error?: string } | null;
        const msg =
          errJson && typeof errJson.error === "string" ? errJson.error : `HTTP ${postRes.status}`;
        throw new Error(msg);
      }

      if (ct.includes("application/json")) {
        const data: unknown = await postRes.json();
        setStatus("done");
        return data as object;
      }

      if (ct.startsWith("text/")) {
        const text = await postRes.text();
        setStatus("done");
        return text;
      }

      const blob = await postRes.blob();
      setStatus("done");
      return blob;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      console.error("[useDownload]", e);
      setError(msg);
      setStatus("error");
      throw e;
    }
  }, []);

  return { download, status, fileInfo, error };
}
