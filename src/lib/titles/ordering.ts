/* ordering.ts — display order: front matter, numbered chapters
   ascending (stable), back matter last. */

import type { ParsedTitle } from "./chapterTitle";
import { parseTitle } from "./chapterTitle";

/* ── Ordering ────────────────────────────────────────────────────────── */

const kindWeight = (p: ParsedTitle): number =>
  p.kind === "front" ? -1 : p.kind === "back" ? 2 : p.number === null ? 1 : 0;

/** Sort chapters for display: front matter, numbered chapters ascending
    (stable for ties and unnumbered entries), then back matter. */
export function compareChapters(a: ParsedTitle, b: ParsedTitle): number {
  const wa = kindWeight(a);
  const wb = kindWeight(b);
  if (wa !== wb) return wa - wb;
  if (wa === 0 && a.number !== b.number)
    return (a.number ?? 0) - (b.number ?? 0);
  return 0; // stable sort keeps API order within equal keys
}

export const sortParsed = <T extends { title?: string | null }>(
  items: T[],
): T[] =>
  items
    .map((it, i) => ({ it, i, p: parseTitle(it.title) }))
    .toSorted((x, y) => compareChapters(x.p, y.p) || x.i - y.i)
    .map((x) => x.it);
