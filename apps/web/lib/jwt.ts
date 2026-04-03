/** Decode JWT `sub` (World ID anonymous id / nullifier) without verifying signature — display only. */
export function decodeJwtSub(token: string | null): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const json = JSON.parse(atob(b64 + pad)) as { sub?: string };
    return json.sub ?? null;
  } catch {
    return null;
  }
}

export function truncateMiddle(s: string, left = 6, right = 4): string {
  if (s.length <= left + right + 3) return s;
  return `${s.slice(0, left)}...${s.slice(-right)}`;
}
