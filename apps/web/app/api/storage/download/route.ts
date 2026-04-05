import { NextRequest, NextResponse } from "next/server";
import {
  assertValidRootHash,
  downloadFile,
  getFileInfo,
} from "@/lib/0g-storage";

export const runtime = "nodejs";

function isMostlyPrintableUtf8(text: string): boolean {
  if (text.length === 0) return true;
  let bad = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13) continue;
    if (c < 32 || c === 0x7f) bad++;
  }
  return bad / text.length < 0.05;
}

function bufferToNextResponse(buf: Buffer): NextResponse {
  const scanLen = Math.min(buf.length, 2048);
  for (let i = 0; i < scanLen; i++) {
    if (buf[i] === 0) {
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": String(buf.length),
        },
      });
    }
  }

  const text = buf.toString("utf8");
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch {
      /* fall through to text/binary */
    }
  }

  if (isMostlyPrintableUtf8(text)) {
    return new NextResponse(text, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(buf.length),
    },
  });
}

/** Query file metadata before download (used by `useDownload`). */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const rootHash = req.nextUrl.searchParams.get("rootHash");
    if (!rootHash?.trim()) {
      return NextResponse.json({ error: "Missing rootHash query parameter" }, { status: 400 });
    }
    assertValidRootHash(rootHash);
    const info = await getFileInfo(rootHash);
    if (info === null) {
      return NextResponse.json({ fileInfo: null });
    }
    return NextResponse.json({
      fileInfo: { size: info.size, finalized: info.finalized, pruned: info.pruned },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Invalid root hash format") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error("[api/storage/download GET]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const rawBody: unknown = await req.json().catch(() => null);
    if (rawBody === null || typeof rawBody !== "object") {
      return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
    }
    const rootHashVal = (rawBody as Record<string, unknown>)["rootHash"];
    if (typeof rootHashVal !== "string") {
      return NextResponse.json({ error: "Missing or invalid rootHash" }, { status: 400 });
    }
    assertValidRootHash(rootHashVal);
    const buf = await downloadFile(rootHashVal);
    return bufferToNextResponse(buf);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (msg === "Invalid root hash format") {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg === "File not found") {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg === "File not finalized") {
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    if (msg === "File has been pruned") {
      return NextResponse.json({ error: msg }, { status: 410 });
    }
    console.error("[api/storage/download POST]", e);
    return NextResponse.json(
      { error: msg.startsWith("Download failed") ? msg : `Download failed: ${msg}` },
      { status: 502 }
    );
  }
}
