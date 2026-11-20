/* lib/titles.ts — chapter/book title parser adapter for the guide API.
   The API titles are uploaded in ~12 ad-hoc formats (see scripts/survey output):
     "6. বস্তুর ওপর তাপের প্রভাব -অধ্যায় ৬- -Pages-375-438-"
     "MCQ - অধ্যায় - 2.1"      "অধ্যায়-০১ <name> - এসএসসি …"
     "১ম অধ্যায় -<name>"        "Unit-01 Sense of Self"   "গদ্য-১; <name> - <author>"
     "SSC Physics Guide Chapter - 1"   "Questions No 1,2,3 (Seen Comprehension)"
     "একত্রিশতম - পঁয়ত্রিশ (1)"  "রুকু ১-৫(1)"   "রচনামূলক প্রশ্নের উত্তর (১-১০)(1)"
   plus upload noise: "(1)", "(1) (1)", "_", double spaces, " - এসএসসি <subject>" tags.
   The API also mixes decomposed (য + ়) and precomposed (য়) Bengali — we normalize
   to precomposed first. This module converts any of them into one clean contract:
     { number, label, display, pageStart, pageEnd, kind }
   and orders chapters correctly (the API's raw order is not the book order). */

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";

/** Bengali digits → ASCII (used for numbers only; display keeps Bengali). */
export function bnNum(s: string): string {
  return s.replace(/[০-৯]/g, (c) => String(BN_DIGITS.indexOf(c)));
}

/** ASCII digits → Bengali (for pretty display of numbers). */
export function toBn(n: number | string): string {
  return String(n).replace(/[0-9]/g, (c) => BN_DIGITS[Number(c)]);
}

/** Normalize Unicode variants the API (and any string literal) mixes:
    decomposed য+় → precomposed য় (U+09DF). Always apply before matching. */
const nz = (s: string): string => s.replace(/\u09AF\u09BC/g, "\u09DF");

/** Ordinal suffixes: ম / য় (both forms) / র্থ / ষ্ঠ / ষ্ট / শ. */
const ORD_SFX = "(?:ম|\\u09AF\\u09BC|\\u09DF|র্থ|ষ্ঠ|ষ্ট|শ)";

/* Bengali ordinals that appear as chapter/poem/lesson order markers. */
const ORD_WORDS_RAW: Record<string, number> = {
  প্রথম: 1,
  দ্বিতীয়: 2,
  তৃতীয়: 3,
  চতুর্থ: 4,
  পঞ্চম: 5,
  ষষ্ঠ: 6,
  সপ্তম: 7,
  অষ্টম: 8,
  নবম: 9,
  দশম: 10,
  একাদশ: 11,
  দ্বাদশ: 12,
  ত্রয়োদশ: 13,
  চতুর্দশ: 14,
  পঞ্চদশ: 15,
  ষোড়শ: 16,
  ষোলতম: 16,
  সপ্তদশ: 17,
  অষ্টাদশ: 18,
  ঊনিশতম: 19,
  বিংশতম: 20,
  বিশতম: 20,
  একবিংশতম: 21,
  একুশতম: 21,
  দ্বাবিংশতম: 22,
  ত্রয়োবিংশতম: 23,
  চতুর্বিংশতম: 24,
  পঞ্চবিংশতম: 25,
  পঁচিশতম: 25,
  ছাব্বিশতম: 26,
  সপ্তবিংশতম: 27,
  অষ্টাবিংশতম: 28,
  ঊনত্রিংশতম: 29,
  ত্রিংশতম: 30,
  ত্রিশতম: 30,
  একত্রিশতম: 31,
  দ্বাত্রিংশতম: 32,
  তেত্রিশতম: 33,
  চৌঁত্রিশতম: 34,
  পঁয়ত্রিশতম: 35,
  ছত্রিশতম: 36,
  সাঁইত্রিশতম: 37,
  আটত্রিশতম: 38,
  ঊনচল্লিশতম: 39,
  চল্লিশতম: 40,
  পঞ্চাশতম: 50,
  ষাটতম: 60,
};
/* keys normalized so lookups never depend on which য় form a literal uses */
const ORD_WORDS: Record<string, number> = Object.fromEntries(
  Object.entries(ORD_WORDS_RAW).map(([k, v]) => [nz(k), v]),
);

/* Chapter-kind markers (front/back matter vs real chapters). Built through nz()
   so the য় form in a literal never matters. */
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

/* ── Book names ──────────────────────────────────────────────────────── */

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
    display: part
      ? `${toBn(major)}. ${name} — অংশ ${toBn(part)}`
      : `${toBn(major)}. ${name}`,
  };
}

/* ── Academic streams ───────────────────────────────────────────────────
   The General branch mixes compulsory subjects with the three SSC streams.
   Grouping follows the user's mapping (বিজ্ঞান = Business per the SSC
   curriculum, where general science belongs to the non-science groups). */
export type Stream =
  "compulsory" | "science" | "business" | "humanities" | "religion" | "extra";

/* every y-like char in a stream pattern accepts all three data forms
   (precomposed য়, decomposed য+়, bare য — uploaders mix them, e.g.
   ব্যবসায়/উদ্যোগ vs গার্হস্থ্য) and whitespace runs are tolerated */
const ANY_Y = "(?:\u09df|\u09af\u09bc|\u09af)";
function streamPat(src: string): RegExp {
  const body = nz(src)
    .replace(/[\u09df\u09af]/g, ANY_Y)
    .replace(/\s+/g, "\\s+");
  return new RegExp("^" + body);
}

const STREAM_MATCHERS: [Stream, RegExp][] = (
  [
    [
      "science",
      "^(পদার্থবিজ্ঞান|রসায়ন|জীববিজ্ঞান|উচ্চতর গণিত|Physics|Chemistry|Biology|Higher Math)",
    ],
    [
      "business",
      "^(হিসাববিজ্ঞান|ব্যবসায় উদ্যোগ|ফিন্যান্স|বিজ্ঞান|Finance|Accounting|Entrepreneurship)",
    ],
    [
      "humanities",
      "^(অর্থনীতি|বাংলাদেশের ইতিহাস|বাংলাদেশ ও বিশ্বপরিচয়|ভূগোল|পৌরনীতি|Economics|Geography|History|Civics)",
    ],
    ["religion", "^(ইসলাম|হিন্দু|বৌদ্ধ|খ্রিস্ট|ধর্ম|Islam|Hindu|Buddh|Christ)"],
    ["extra", "^(গার্হস্থ্যবিজ্ঞান|কৃষিশিক্ষা|Home Science|Agriculture)"],
  ] as [Stream, string][]
).map(([st, src]) => [st, streamPat(src)]);

export function streamOf(bookName: string): Stream {
  const n = nz(bookName.trim());
  for (const [stream, re] of STREAM_MATCHERS) if (re.test(n)) return stream;
  return "compulsory";
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

export const STREAM_LABEL: Record<Stream, string> = {
  compulsory: "Compulsory",
  science: "Science",
  business: "Business Studies",
  humanities: "Humanities",
  religion: "Religion",
  extra: "Extra",
};
