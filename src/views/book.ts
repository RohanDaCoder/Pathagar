/* views/book.ts — chapter list of one book + download toolbar
   Registers itself as DL.onRowUpdate so the download queue can re-paint
   chapter rows without importing this module (no circular deps). */
import { S } from "../config";
import {
  $,
  $$,
  requireEl,
  bn,
  esc,
  fmtMB,
  toast,
  viewHead,
  crumbs,
  svgDownload,
  svgCheck,
  svgRetry,
  svgWarn,
  svgOffline,
  svgPdf,
} from "../utils";
import { DB } from "../db";
import { loadSnapshot, getChapters } from "../catalog";
import { DL } from "../dlqueue";
import { openReader } from "../reader";
import type { Book, Chapter, ListResult } from "../types";

interface BookPageState {
  book: Book;
  chapters: Chapter[];
  saved: Set<string>;
  sizes: Record<string, number>;
}
let BookPage: BookPageState | null = null; // state for the open book view

export function chapterRowHtml(i: number, ch: Chapter): string {
  const id = String(ch.id);
  const st = S.dl.get(id);
  const saved = BookPage?.saved.has(id);
  let right = `<button class="chbtn" data-act="dl" aria-label="Download">${svgDownload}</button>`;
  let cls = "row";
  let sub = "";
  if (st?.status === "downloading") {
    cls += " dl-active";
    right = `<button class="pct" data-act="cancel" title="Cancel">${bn(st.pct)}%</button>`;
    sub = `<div class="minibar"><i style="width:${st.pct}%"></i></div>`;
  } else if (st?.status === "queued") {
    right = `<button class="pct" data-act="cancel" title="Cancel">…</button>`;
  } else if (st?.status === "error") {
    cls += " dl-error";
    right = `<button class="chbtn err" data-act="dl" aria-label="Retry">${svgRetry}</button>`;
    sub = `<span style="color:var(--danger);font-size:.75rem">${esc(st.error || "Failed")}</span>`;
  } else if (saved) {
    cls += " done";
    right = `<button class="chbtn ok" data-act="read" aria-label="Read">${svgCheck}</button>`;
    const size = BookPage?.sizes[id];
    sub = `<span class="chip ok">Offline${size ? ` · ${fmtMB(size)}` : ""}</span>`;
  }
  return `<div class="${cls}" data-ch="${id}" data-i="${i}">
    <div class="chno">${bn(i + 1)}</div>
    <div class="rmain"><div class="rtitle">${esc(ch.title || "Chapter")}${sub}</div></div>
    ${right}</div>`;
}

function paintBookToolbar() {
  const bar = $("#bookbar");
  const btn = $("#dlallbtn");
  if (!bar || !BookPage) return;
  const total = BookPage.chapters.length;
  let done = 0;
  let active = 0;
  let errs = 0;
  for (const ch of BookPage.chapters) {
    const id = String(ch.id);
    const st = S.dl.get(id);
    if (BookPage.saved.has(id) || st?.status === "done") done++;
    else if (st?.status === "downloading" || st?.status === "queued") active++;
    else if (st?.status === "error") errs++;
  }
  const pct = total ? Math.floor((done / total) * 100) : 0;
  bar.innerHTML = `<i class="${errs && !active ? "err" : ""}" style="width:${pct}%"></i>`;
  bar.dataset.done = String(done);
  bar.dataset.total = String(total);
  if (btn) {
    btn.innerHTML =
      done >= total && total
        ? `${svgCheck} Done`
        : `${svgDownload} Download all (${bn(done)}/${bn(total)})`;
    (btn as HTMLButtonElement).disabled = done >= total && total > 0;
  }
}

/* chapter rows carry their chapter/book wiring as expando props */
interface WiredRow extends HTMLElement {
  _ch?: Chapter;
  _book?: Book;
  _chIndex?: number;
}

function wireRow(row: HTMLElement, ch: Chapter, book: Book, i: number) {
  const w = row as WiredRow;
  w._ch = ch;
  w._book = book;
  w._chIndex = i;
  row.addEventListener("click", (ev) => {
    const act = (ev.target as Element)
      .closest("[data-act]")
      ?.getAttribute("data-act");
    const id = String(ch.id);
    if (act === "cancel") {
      DL.cancel(id);
      return;
    }
    if (act === "read" || BookPage?.saved.has(id)) {
      openReader(id);
      return;
    }
    DL.enqueue(ch, book, { autoOpen: true });
  });
}

/* re-render a single chapter row + the book toolbar, if visible */
function updateChapterRow(id: string) {
  const row = $(`.row[data-ch="${id}"]`);
  if (!row) return;
  let {
    _ch: ch,
    _book: book,
    _chIndex: i,
  } = row as typeof row & { _ch: Chapter; _book: Book; _chIndex: number };
  if ((!ch || !book) && BookPage) {
    i = Number.parseInt(row.dataset.i || "0", 10);
    ch = BookPage.chapters[i];
    book = BookPage.book;
  }
  if (!ch || !book) return;
  const st = S.dl.get(id);
  if (st?.status === "done" && BookPage) {
    BookPage.saved.add(id);
    if (st.size) BookPage.sizes[id] = st.size;
  }
  row.outerHTML = chapterRowHtml(i, ch);
  const nr = $(`.row[data-ch="${id}"]`);
  if (nr) wireRow(nr, ch, book, i);
  paintBookToolbar();
}
DL.onRowUpdate = updateChapterRow;

export async function renderBook(bookId: string | undefined) {
  const ctx = bookId ? S.bookCtx.get(String(bookId)) : undefined;
  const snap = loadSnapshot();
  let bookName = ctx?.name;
  let branchId = ctx?.branchId;
  if (!bookName) {
    // deep link: find in snapshot
    for (const b of snap.branches) {
      const f = b.books.find((x) => String(x.id) === String(bookId));
      if (f) {
        bookName = f.name;
        branchId = b.id;
        break;
      }
    }
  }
  const branchLabel = snap.branches.find((b) => b.id === branchId)?.label || "";
  requireEl("#view").innerHTML = `<div class="page">
    ${viewHead(bookName || "Book", branchLabel)}
    ${crumbs(branchLabel)}
    <div class="toolbar">
      <div class="bigbar" id="bookbar"><i style="width:0"></i></div>
      <button class="btn sm" id="dlallbtn">${svgDownload} Download all</button>
    </div>
    <div class="list" id="rows"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>
  </div>`;
  let data: ListResult<Chapter>;
  try {
    data = await getChapters(bookId || "");
  } catch (e) {
    const err = e as Error & { status?: number };
    requireEl("#rows").innerHTML =
      `<div class="empty">${svgWarn}<div class="t">Couldn't load the chapter list</div>
      <div>${err.status === 403 ? "API key revoked — set a new one in Settings." : esc(err.message || "Network problem")}</div></div>`;
    return;
  }
  const metas = (await DB.allMeta()).filter((m) => m.bookId === String(bookId));
  BookPage = {
    book: { id: String(bookId), name: bookName || "Book", branchId },
    chapters: data.items,
    saved: new Set(metas.map((m) => m.id)),
    sizes: Object.fromEntries(metas.map((m) => [m.id, m.size || 0])),
  };
  requireEl("#rows").innerHTML =
    (data.stale
      ? `<div class="banner warn">${svgOffline} Offline — saved list</div>`
      : "") +
    (data.items.length
      ? data.items.map((ch, i) => chapterRowHtml(i, ch)).join("")
      : `<div class="empty">${svgPdf}<div class="t">No chapters found for this book</div></div>`);
  paintBookToolbar();

  $$("#rows .row[data-ch]").forEach((row) => {
    const i = Number.parseInt(row.dataset.i || "0", 10);
    if (BookPage) wireRow(row, BookPage.chapters[i], BookPage.book, i);
  });
  $("#dlallbtn")?.addEventListener("click", () => {
    if (!BookPage) return;
    let n = 0;
    for (const ch of BookPage.chapters) {
      const id = String(ch.id);
      if (!BookPage.saved.has(id) && !S.dl.has(id)) {
        DL.enqueue(ch, BookPage.book);
        n++;
      }
    }
    if (n) toast(`Started downloading ${bn(n)} chapters`);
  });
}
