/** Short hex root for cards / UI (e.g. 0xabc1…9f2a). */
export function shortenRoot(root: string | null | undefined, head = 6, tail = 4): string {
  if (!root || root.length < head + tail + 3) return root || "—";
  return `${root.slice(0, head + 2)}…${root.slice(-tail)}`;
}
