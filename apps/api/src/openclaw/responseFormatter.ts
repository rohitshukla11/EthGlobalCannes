/**
 * Shapes raw model output into consultation-style text for Counselr (presentation only).
 */

function stripExistingRolePrefix(text: string): string {
  const m = text.match(/^As a[n]?\s+[^:\n]+:\s*\n*/i);
  if (m && m[0]) return text.slice(m[0].length).trim();
  return text.trim();
}

/** Split into numbered key points when multiple sentences; otherwise a short summary block. */
export function transformToStructured(text: string, preferList: boolean): string {
  const t = text.trim();
  if (!t) return "*(No substantive reply generated.)*";

  const bySentence = t.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  let points = bySentence.length ? bySentence : [t];

  if (points.length < 2 && preferList && t.includes(";")) {
    const alt = t.split(/\s*;\s+/).filter((p) => p.trim().length > 0);
    if (alt.length >= 2) points = alt;
  }

  if (points.length >= 2) {
    let result = "**Key points**\n\n";
    points.slice(0, 6).forEach((p, i) => {
      result += `${i + 1}. ${p.trim()}\n`;
    });
    if (points.length > 6) {
      result += `\n_Additional context omitted for brevity._\n`;
    }
    return result.trimEnd();
  }

  return `**Summary**\n\n${t}`;
}

const GENERIC_PHRASE = /\b(you should consider|it's important to note|as an ai|i cannot provide)\b/i;

function shouldForceStructure(reply: string): boolean {
  const s = reply.trim();
  return s.length < 50 || GENERIC_PHRASE.test(s);
}

/**
 * Wraps the user-visible reply with role framing, structure, and a short disclaimer.
 */
export function formatProfessionalResponse(input: { reply: string; profession?: string }): string {
  const roleLabel = input.profession?.trim() || "professional advisor";
  const body = stripExistingRolePrefix(input.reply);
  const preferList = shouldForceStructure(body);
  const structured = transformToStructured(body, preferList);

  return `As a ${roleLabel}:\n\n${structured}\n\n---\n*General guidance only — not formal professional advice. For legal, tax, or investment decisions, consult a qualified professional in your jurisdiction.*`;
}
