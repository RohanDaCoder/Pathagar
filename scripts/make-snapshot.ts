/* scripts/make-snapshot.ts — regenerate src/catalog-snapshot.json.
   Walks the guide API, runs every chapter title through the parser adapter
   (src/lib/titles.ts) and writes the clean, ordered contract that ships in
   the app bundle. Run from the repo root:  bun scripts/make-snapshot.ts */

import {
  compareChapters,
  parseTitle,
  parseBookName,
  withMathNames,
} from "../src/lib/titles";

const API = "https://books.tetashweb.xyz/api/v1/app/";
/* Upload-side name fixes applied before parsing, so regenerating the
   snapshot keeps them (API names with mixed English/Bengali spelling). */
const NAME_FIXES: Record<string, string> = {
  "বাংলা 2nd পত্র গাইড (SSC 2028)": "বাংলা ২য় পত্র গাইড (SSC 2028)",
};
// The key ships in the original app; see AGENTS.md before changing endpoints.
const KEY = "qbznP4XjGALmagvQOOlN5zVZmcovJfHPE1a3xHmPnV2B9eQz52yC3wm7nVbqqyG3";
/* branch roots of the guide tree (see the Stage-1 report) */
const BRANCHES: { id: number; label: string }[] = [
  { id: 18203, label: "Bangla Version (SSC 2028)" },
  { id: 17786, label: "মাদ্রাসার গাইড (Madrasah Guide)" },
  { id: 17794, label: "English Version Guide (Nine)" },
  { id: 101, label: "নবম শ্রেণীর গাইড, পুরাতন (Older guide set)" },
];

interface RawChapter {
  id: number;
  title: string;
  pdf: string;
}
function isChapter(x: unknown): x is RawChapter {
  if (typeof x !== "object" || x === null) return false;
  const id = Reflect.get(x, "id");
  const pdf = Reflect.get(x, "pdf");
  return typeof id === "number" && typeof pdf === "string";
}

function isBook(x: unknown): x is RawBook {
  if (typeof x !== "object" || x === null) return false;
  const id = Reflect.get(x, "id");
  const name = Reflect.get(x, "name");
  return typeof id === "number" && typeof name === "string";
}

interface RawBook {
  id: number;
  name: string;
  image?: string | null;
  order?: number;
}

async function get(path: string, params: Record<string, string | number>) {
  const u = new URL(API + path);
  u.searchParams.set("key", KEY);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const r = await fetch(u);
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
  // API boundary: guide API's documented envelope; validated by Stage-1 harness
  const env: unknown = await r.json();
  const data =
    typeof env === "object" && env !== null ? Reflect.get(env, "data") : null;
  const rawPg =
    typeof env === "object" && env !== null
      ? Reflect.get(env, "pagination")
      : null;
  const totalPage =
    typeof rawPg === "object" && rawPg !== null
      ? Reflect.get(rawPg, "total_page")
      : undefined;
  return {
    data: Array.isArray(data) ? data : [],
    pagination:
      totalPage === undefined ? undefined : { total_page: `${totalPage}` },
  };
}

async function chaptersOf(bookId: number): Promise<RawChapter[]> {
  const out: RawChapter[] = [];
  let page = 1;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- pagination must stay sequential
    const d = await get("books", { category: bookId, limit: 300, page });
    const batch = d.data.filter(isChapter);
    out.push(...batch);
    const tp = Number.parseInt(`${d.pagination?.total_page ?? 1}`, 10);
    if (page >= tp || !batch.length) break;
    page++;
  }
  return out;
}

const snap = {
  generated: new Date().toISOString(),
  source: API,
  branches: [] as unknown[],
};

let totalChapters = 0;
for (const br of BRANCHES) {
  // eslint-disable-next-line no-await-in-loop -- branches load sequentially by design
  const branchBooks = await get("categories", { parent: br.id, limit: 200 });
  const booksRaw = (branchBooks.data || []).filter(isBook);
  const books = [];
  for (const rawBook of booksRaw.toSorted(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )) {
    const bk = { ...rawBook, name: NAME_FIXES[rawBook.name] ?? rawBook.name };
    // eslint-disable-next-line no-await-in-loop -- chapters of one book load sequentially
    const raw = await chaptersOf(bk.id);
    const parsed = raw
      .map((c) => ({ c, p: withMathNames(bk.name, parseTitle(c.title)) }))
      .toSorted((x, y) => compareChapters(x.p, y.p));
    const chapterList = parsed.map(({ c, p }) => ({
      id: c.id,
      num: p.number,
      label: p.label,
      display: p.display,
      pages: p.pageStart ? [p.pageStart, p.pageEnd] : null,
      kind: p.kind,
      pdf: c.pdf,
    }));
    totalChapters += chapterList.length;
    const bp = parseBookName(bk.name);
    books.push({
      id: bk.id,
      name: bk.name,
      cleanName: bp.name,
      tags: bp.tags,
      image: bk.image ?? undefined,
      order: bk.order,
      chapters: chapterList.length,
      chapterList,
    });
    console.log(`  ${bk.name}: ${chapterList.length} chapters`);
  }
  snap.branches.push({
    id: br.id,
    label: br.label,
    total_chapters: books.reduce((a, b) => a + b.chapters, 0),
    books,
  });
}

await Bun.write(
  new URL("../src/catalog-snapshot.json", import.meta.url),
  JSON.stringify(snap),
);
console.log(
  `Wrote src/catalog-snapshot.json — ${snap.branches.length} branches, ${totalChapters} chapters`,
);
