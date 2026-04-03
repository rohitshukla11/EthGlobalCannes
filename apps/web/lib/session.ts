const TOKEN_KEY = "twinnet_jwt";
const VERIFIED_AT_KEY = "twinnet_worldid_verified_at";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(t: string | null) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getVerifiedAt(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(VERIFIED_AT_KEY);
}

export function setVerifiedAt(iso: string | null) {
  if (iso) localStorage.setItem(VERIFIED_AT_KEY, iso);
  else localStorage.removeItem(VERIFIED_AT_KEY);
}
