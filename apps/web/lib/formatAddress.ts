export function formatEthAddress(raw: string): string {
  const s = raw.trim().replace(/\s/g, "");
  if (!s.startsWith("0x")) return raw;
  const hex = s.slice(2).replace(/[^0-9a-fA-F]/g, "");
  const limited = hex.slice(0, 40);
  if (limited.length === 0) return "0x";
  return `0x${limited}`;
}

export function shortAddress(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Full 0x + 40 hex: show 0x1234...5678; otherwise show as-is (while typing). */
export function displayEthAddress(stored: string): string {
  const s = stored.trim();
  if (s.length === 42 && s.startsWith("0x")) {
    return `${s.slice(0, 6)}...${s.slice(-4)}`;
  }
  return s;
}
