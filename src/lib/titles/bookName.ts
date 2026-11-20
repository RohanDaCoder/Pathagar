/* bookName.ts — book (subject) names: strip guide/MCQ/SSC decorations,
   and pair the MCQ/CQ twin uploads of one subject. */

import { nz } from "./bengali";

export interface ParsedBook {
  name: string; // clean name, no "(SSC 2028)" / "MCQ" / "বই" suffix
  tags: string[]; // ["SSC 2028", "MCQ", "CQ", …]
}

export function parseBookName(raw: string): ParsedBook {
  const tags: string[] = [];
  let name = nz(raw.trim());
  // SSC year tag — normally "(SSC 2028)"; one 2028 upload (ইংরেজি ১ম পত্র)
  // spells the year bare at the end, so accept both spellings
  const m = name.match(/\(?\s*(SSC\s*\d{4})\s*\)?\s*$/i);
  if (m) {
    tags.push(m[1].replace(/\s+/g, " ").toUpperCase());
    name = name.replace(m[0], "").trim();
  }
  const mcq = name.match(/\b(MCQ|CQ)\b\s*$/i);
  if (mcq) {
    tags.push(mcq[1].toUpperCase());
    name = name.replace(mcq[0], "").trim();
  }
  name = name
    .replace(/\s*গাইড\s*বই$/, "")
    .replace(/\s+বই$/, "")
    .replace(/\s*গাইড$/, "")
    .trim();
  return { name: name || raw, tags };
}

/** the MCQ/CQ marker of an upload ("গণিত গাইড MCQ (SSC 2028)" → "MCQ") */
export function isMcqBook(raw: string): boolean {
  return parseBookName(raw).tags.includes("MCQ");
}

/** pairing key: the subject without guide/MCQ/CQ/SSC decorations — two books
    with the same core are the same subject (CQ book + its MCQ twin) */
export function bookCore(raw: string): string {
  return parseBookName(raw).name.replace(/\s+/g, " ").trim();
}

/** Two books are twins when they share a subject core but ship opposite
    variants (one MCQ upload + one CQ upload of the same subject). */
export function isTwin(a: { name: string }, b: { name: string }): boolean {
  return (
    bookCore(a.name) === bookCore(b.name) &&
    isMcqBook(a.name) !== isMcqBook(b.name)
  );
}
