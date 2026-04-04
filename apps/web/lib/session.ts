const TOKEN_KEY = "counselr_jwt";
const LEGACY_TOKEN_KEYS = ["alter_jwt", "twinnet_jwt"] as const;
const VERIFIED_AT_KEY = "counselr_worldid_verified_at";
const LEGACY_VERIFIED_AT_KEYS = ["alter_worldid_verified_at", "twinnet_worldid_verified_at"] as const;

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  const primary = localStorage.getItem(TOKEN_KEY);
  if (primary) return primary;
  for (const k of LEGACY_TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function setStoredToken(t: string | null) {
  if (t) {
    localStorage.setItem(TOKEN_KEY, t);
    for (const k of LEGACY_TOKEN_KEYS) localStorage.removeItem(k);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    for (const k of LEGACY_TOKEN_KEYS) localStorage.removeItem(k);
  }
}

export function getVerifiedAt(): string | null {
  if (typeof window === "undefined") return null;
  const primary = localStorage.getItem(VERIFIED_AT_KEY);
  if (primary) return primary;
  for (const k of LEGACY_VERIFIED_AT_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export function setVerifiedAt(iso: string | null) {
  if (iso) {
    localStorage.setItem(VERIFIED_AT_KEY, iso);
    for (const k of LEGACY_VERIFIED_AT_KEYS) localStorage.removeItem(k);
  } else {
    localStorage.removeItem(VERIFIED_AT_KEY);
    for (const k of LEGACY_VERIFIED_AT_KEYS) localStorage.removeItem(k);
  }
}
