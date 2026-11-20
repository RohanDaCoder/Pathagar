/* mathNames.ts — the SSC-2028 গণিত গাইড uploads nameless chapter titles
   ("অধ্যায় - 2.1"); give them the official NCTB chapter names. */

import { bnNum } from "./bengali";
import type { ParsedTitle } from "./chapterTitle";

/* ── Nameless-2028 math override ────────────────────────────────────────
   The SSC-2028 গণিত গাইড (MCQ + CQ) uploads bare "অধ্যায় - 2.1" titles with
   no chapter names. The official NCTB সাধারণ গণিত chapter list below is
   cross-verified against two other books in this very catalog that DO carry
   the names ("Math class 9&10" and "Math (Clear Page)", older set). */
const GENERAL_MATH_CHAPTERS: Record<number, string> = {
  1: "বাস্তব সংখ্যা",
  2: "সেট ও ফাংশন",
  3: "বীজগাণিতিক রাশি",
  4: "সূচক ও লগারিদম",
  5: "এক চলক বিশিষ্ট সমীকরণ",
  6: "রেখা, কোন ও ত্রিভুজ",
  7: "ব্যাবহারিক জ্যামিতি",
  8: "বৃত্ত",
  9: "ত্রিকোণমিতিক অনুপাত",
  10: "দূরত্ব ও উচ্চতা",
  11: "বীজগণিতীয় অনুপাত ও সমানুপাত",
  12: "দুই চলক বিশিষ্ট সরল সহসমীকরণ",
  13: "সসীম ধারা",
  14: "অনুপাত, সদৃশতা ও প্রতিসমতা",
  15: "ক্ষেত্রফল সম্পর্কিত উপপাদ্য ও সম্পাদ্য",
  16: "পরিমিতি",
  17: "পরিসংখ্যান",
};

/* "nameless" = the display is nothing beyond the chapter word + number
   (raw "অধ্যায় - 2.1" vs label "অধ্যায় ২.১") — compare with digits, Bengali
   digits and separators removed, so form differences never matter. */
const bareTitle = (x: string): string => bnNum(x).replace(/[\s.\-–:]/g, "");

function isNameless(p: ParsedTitle): boolean {
  if (!p.label) return false;
  const d = bareTitle(p.display);
  return d.length > 0 && d === bareTitle(p.label);
}

/** Give the nameless গণিত guide chapters their official NCTB names.
    Only fires when parsing left nothing but the number, so books whose
    uploads carry real names are untouched. */
export function withMathNames(bookName: string, p: ParsedTitle): ParsedTitle {
  if (p.number === null || !isNameless(p)) return p;
  if (!/^গণিত\s*গাইড/.test(bookName.trim())) return p; // উচ্চতর গণিত excluded
  const major = Math.floor(p.number);
  const name = GENERAL_MATH_CHAPTERS[major];
  if (!name) return p;
  const part = Math.round((p.number - major) * 10);
  return {
    ...p,
    /* chapter numbers render in English numerals app-wide */
    display: part ? `${major}. ${name} — অংশ ${part}` : `${major}. ${name}`,
  };
}
