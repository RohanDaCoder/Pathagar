/* chapterTitle.ts — parse the API's ~12 ad-hoc chapter-title formats into
   one contract: { number, label, display, pageStart, pageEnd, kind }.
   Format inventory and noise rules: see AGENTS.md. */

import { bnNum, nz, toBn } from "./bengali";
import { ORD_SFX, ORD_WORDS } from "./ordinals";

/** drop a leading "২." / "2. " chapter number — the অধ্যায় badge already
    shows it, so "২. সেট ও ফাংশন" renders as "সেট ও ফাংশন" */
export function stripLeadNum(s: string): string {
  return s.replace(/^[০-৯0-9]+\.\s*/, "").trim();
}

const FRONT = [
  /সূচিপত্র/,
  /তথ্যাবলি/,
  /সংক্ষেপিত/,
  /অ্যাব্রিভিয়েশন/,
  /শব্দাবলি/,
  /^toc\b/i,
  /^contents?\b/i,
  /^table\s+of\s+contents\b/i,
  /^index\b/i,
  /^preface\b/i,
  /^introduction\b/i,
].map((r) => new RegExp(nz(r.source), r.flags));
const BACK = [
  /মডেল\s*টেস্ট/,
  /ব্যবহারিক/,
  /বোর্ড/,
  /উত্তরমালা/,
  /সাজেশন/,
  /পরিশিষ্ট/,
  /সংযোজন/,
  /এক\s*কথায়/,
  /টীকামূলক/,
  /রচনামূলক/,
  /শ্রেণির\s*কাজ/,
  /বহুনির্বাচনি/,
  /অভীক্ষা/,
  /\bmodel\s*(test|question)/i,
  /\bspecial\b/i,
  /\bboard\b/i,
  /\bpractical\b/i,
  /\banswer/i,
  /\bappendix\b/i,
  /\bguide\s*exam\b/i,
].map((r) => new RegExp(nz(r.source), r.flags));

export type ChapterKind = "front" | "chapter" | "back";

export interface ParsedTitle {
  /** 1-based chapter/order number for sorting; null when the title has none. */
  number: number | null;
  /** Short badge text, e.g. "অধ্যায় ৬", "Unit 1", "গদ্য ৩", "Q 7". */
  label: string | null;
  /** Human-clean display title (noise stripped, Bengali preserved). */
  display: string;
  pageStart: number | null;
  pageEnd: number | null;
  kind: ChapterKind;
}

/* One number candidate found in a title. */
interface Cand {
  n: number;
  strip: string; // matched span to remove from the display title
  label: string; // badge text for this candidate
  w: number; // preference weight (lower wins)
}

const BN_NUM = String.raw`([০-৯0-9]+(?:\.[০-৯0-9]+)?)`;
const ADH = nz("অধ্যায়"); // always the precomposed form
/* Bengali word character: letters, matras, nukta, precomposed য় etc. — NOT digits.
   ([অ-হ] alone is wrong: it excludes the vowel signs া ি ী …) */
const BENG = "[\\u0980-\\u09E5\\u09DC-\\u09FD]";

/** All number candidates in a title, most specific first. */
function findCandidates(t: string): Cand[] {
  const out: Cand[] = [];
  const push = (c: Cand) => out.push(c);

  // "… -অধ্যায় ৬- …" (suffix; the most reliable source)
  let m = t.match(new RegExp(String.raw`[-–]\s*${ADH}\s*[-–]?\s*${BN_NUM}`));
  if (m)
    push({
      n: parseFloat(bnNum(m[1])),
      strip: m[0],
      label: `${ADH} ${toBn(m[1])}`,
      w: 0,
    });

  // "Unit-01 <name>" / "Lesson 5 …" / "Chapter 4 …" / "পাঠ ৩" / "অধ্যায় ২ …"
  // (not when an ordinal suffix follows the number — "পাঠ ৬ষ্ঠ" is w=5's job)
  m = t.match(
    new RegExp(
      String.raw`^(unit|chapter|ch|lesson|lecture|part|পাঠ|${ADH})\s*[-–:.]?\s*${BN_NUM}(?!${ORD_SFX})`,
      "i",
    ),
  );
  if (m) {
    const en = /^[a-z]+$/i.test(m[1]); // English label → keep ASCII digits
    push({
      n: parseFloat(bnNum(m[2])),
      strip: m[0],
      label: `${m[1]} ${en ? m[2] : toBn(m[2])}`,
      w: 1,
    });
  }

  // "1. <name>" / "11 .<name>" / "2 - <name>" / "3) <name>" / "2.1 <name>" (leading bare).
  // The separator is an alternation of two classes — a single class like [.、:)-–]
  // would form the range ")"…"–" and swallow every Bengali letter.
  m = t.match(new RegExp(`^${BN_NUM}(?:\\s*(?:[.、:]|[-–])\\s*|\\s+)(?=\\S)`));
  if (m)
    push({ n: parseFloat(bnNum(m[1])), strip: m[0], label: toBn(m[1]), w: 2 });

  // "… Chapter - 1" / "… - অধ্যায় ১" (number at the very end)
  m = t.match(
    new RegExp(
      String.raw`[-–]?\s*(?:chapter|${ADH})\s*[-–]\s*${BN_NUM}\s*$`,
      "i",
    ),
  );
  if (m)
    push({
      n: parseFloat(bnNum(m[1])),
      strip: m[0],
      label: `${ADH} ${toBn(m[1])}`,
      w: 3,
    });

  // "১ম অধ্যায় …" / "৪র্থ পাঠ …" / "৬ষ্ট পাঠ" (digit ordinal + label)
  m = t.match(
    new RegExp(String.raw`^([০-৯]+)${ORD_SFX}\s+(${ADH}|পাঠ|পরিচ্ছেদ)`),
  );
  if (m)
    push({
      n: parseFloat(bnNum(m[1])),
      strip: m[0],
      label: `${m[2]} ${toBn(m[1])}`,
      w: 4,
    });

  // "পাঠ ৬ষ্ঠ - ১০ম" (label, digit ordinal, optional range)
  m = t.match(
    new RegExp(
      String.raw`^(${ADH}|পাঠ)\s*([০-৯]+)${ORD_SFX}?(?:\s*[-–]\s*[০-৯]+${ORD_SFX}?)?`,
    ),
  );
  if (m)
    push({
      n: parseFloat(bnNum(m[2])),
      strip: m[0],
      label: `${m[1]} ${toBn(m[2])}`,
      w: 5,
    });

  // bare digit ordinal "১ম …" (no label word after)
  m = t.match(new RegExp(`^([০-৯]+)${ORD_SFX}\\s+`));
  if (m)
    push({ n: parseFloat(bnNum(m[1])), strip: m[0], label: toBn(m[1]), w: 6 });

  // "একাদশ - পঞ্চদশ" / "একত্রিশতম - পঁয়ত্রিশ" (word ordinals, may be a range)
  m = t.match(
    new RegExp(`^(${BENG}+)(?:\\s*[-–]\\s*(${BENG}+))?\\s*(?=$|[\\s(,.:;])`),
  );
  if (m && ORD_WORDS[m[1]])
    push({
      n: ORD_WORDS[m[1]],
      strip: m[0],
      label: toBn(ORD_WORDS[m[1]]),
      w: 7,
    });

  // "MCQ - অধ্যায় - 2.1" (label noise, word, then number at the end)
  m = t.match(
    new RegExp(String.raw`^\S[^-]*?\s*[-–]\s*${ADH}\s*[-–]\s*${BN_NUM}\s*$`),
  );
  if (m)
    push({
      n: parseFloat(bnNum(m[1])),
      strip: m[0],
      label: `${ADH} ${toBn(m[1])}`,
      w: 8,
    });

  // "গদ্য-১;" / "কবিতা-৩:" (Bengali prose/poem numbering: word-numeral;punct)
  m = t.match(/^(\S{1,14})-([০-৯0-9]+)\s*[;:：]/);
  if (m && !/^(?:19|20)\d{2}$/.test(bnNum(m[2])))
    push({
      n: parseFloat(bnNum(m[2])),
      strip: m[0],
      label: `${m[1]} ${toBn(m[2])}`,
      w: 9,
    });

  // "Questions No 1,2,3 …" / "Question -10 …" / "Question NO -7 …" (exam banks)
  m = t.match(/^questions?\s*(?:no\.?|number)?\s*[-–:]?\s*(\d+)/i);
  if (m)
    push({
      n: parseFloat(m[1]),
      strip: m[0],
      label: `প্র ${toBn(m[1])}`,
      w: 10,
    });

  // "রুকু ১-৫" / "সুরা আল বাকারা,১ম - ৫ম পাঠ" (Quran sections, may be ranges).
  // Number only — the display keeps the full section name.
  m = t.match(
    new RegExp(
      String.raw`^(রুকু|সুরা)[^\d০-৯]*?${BN_NUM}${ORD_SFX}?(?:\s*[-–]\s*[০-৯]+${ORD_SFX}?)*`,
    ),
  );
  if (m)
    push({
      n: parseFloat(bnNum(m[2])),
      strip: "",
      label: `${m[1]} ${toBn(m[2])}`,
      w: 11,
    });

  // "রচনামূলক প্রশ্নের উত্তর (১-১০)" (range in parens — sort by first)
  m = t.match(
    new RegExp(String.raw`\(${BN_NUM}\s*[-–]\s*[০-৯0-9]+\)\s*(?:\(1\)\s*)*$`),
  );
  if (m)
    push({ n: parseFloat(bnNum(m[1])), strip: "", label: toBn(m[1]), w: 12 });

  return out.toSorted((a, b) => a.w - b.w);
}

/** Strip upload noise from a display title (keeps meaningful dashes). */
function cleanDisplay(t: string): string {
  return t
    .replace(/\s*-\s*এসএসসি.*$/, "") // " - এসএসসি বাংলা ব্যাকরণ" tag suffix
    .replace(/[\s_]+/g, " ") // underscores / runs of spaces
    .replace(/\(\s*1\s*\)(\s*\(\s*1\s*\))*/g, "") // "(1)" "(1) (1)" upload noise
    .replace(/\(\s*\)/g, "")
    .replace(/(?:\s*[-–;:,])+\s*$/, "") // trailing punctuation (possibly repeated)
    .replace(/^\s*(?:[-–;:,]\s*)+/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function parseTitle(raw: string | undefined | null): ParsedTitle {
  const t = nz((raw || "").trim());
  const pages = t.match(/[-–\s]?pages[-–](\d+)[-–](\d+)[-–\s]?/i);
  const body = pages ? t.replace(pages[0], "") : t;

  const kind: ChapterKind = FRONT.some((r) => r.test(t))
    ? "front"
    : BACK.some((r) => r.test(t))
      ? "back"
      : "chapter";

  // front/back matter keeps API order (no number hunting) — e.g. "ব্যবহারিক অংশ-১"
  const cands = kind === "chapter" ? findCandidates(body) : [];
  let display = body;
  let label: string | null = null;
  let number: number | null = null;
  if (cands.length) {
    number = cands[0].n;
    label = cands[0].label;
    for (const c of cands) display = display.replace(c.strip, "");
  }
  display = cleanDisplay(display);
  if (!display) display = cleanDisplay(body); // number-only titles keep the words
  // titles that were nothing but a label ("MCQ - অধ্যায় - 2.1") show the badge;
  // a single Bengali word ("সুদ") is a real title and stays
  if (display.length < 4 && label && !/[\u0980-\u09FD]/.test(display))
    display = label;
  if (!display) display = t; // never return an empty title
  return {
    number,
    label,
    display,
    pageStart: pages ? Number(pages[1]) : null,
    pageEnd: pages ? Number(pages[2]) : null,
    kind,
  };
}
