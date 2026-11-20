/* views/book.js — chapter list of one book + download toolbar
   Registers itself as DL.onRowUpdate so the download queue can re-paint
   chapter rows without importing this module (no circular deps). */
import { S } from '../config.js';
import { $, $$, bn, esc, fmtMB, toast, viewHead, crumbs, svgDownload, svgCheck, svgRetry, svgChev, svgWarn, svgOffline, svgPdf } from '../utils.js';
import { DB } from '../db.js';
import { loadSnapshot, getChapters } from '../catalog.js';
import { DL } from '../dlqueue.js';
import { openReader } from '../reader.js';

let BookPage = null; // {book, chapters, saved:Set, sizes:{}} for the open book view

export function chapterRowHtml(i, ch, book) {
  const id = String(ch.id);
  const st = S.dl.get(id);
  const saved = BookPage?.saved?.has(id);
  let right = `<button class="chbtn" data-act="dl" aria-label="ডাউনলোড">${svgDownload}</button>`;
  let cls = 'row', sub = '';
  if (st?.status === 'downloading') {
    cls += ' dl-active';
    right = `<button class="pct" data-act="cancel" title="বাতিল করুন">${bn(st.pct)}%</button>`;
    sub = `<div class="minibar"><i style="width:${st.pct}%"></i></div>`;
  } else if (st?.status === 'queued') {
    right = `<button class="pct" data-act="cancel" title="বাতিল করুন">…</button>`;
  } else if (st?.status === 'error') {
    cls += ' dl-error';
    right = `<button class="chbtn err" data-act="dl" aria-label="আবার চেষ্টা">${svgRetry}</button>`;
    sub = `<span style="color:var(--danger);font-size:.75rem">${esc(st.error || 'ব্যর্থ')}</span>`;
  } else if (saved) {
    cls += ' done';
    right = `<button class="chbtn ok" data-act="read" aria-label="পড়ুন">${svgCheck}</button>`;
    const size = BookPage?.sizes?.[id];
    sub = `<span class="chip ok">অফলাইন${size ? ' · ' + fmtMB(size) : ''}</span>`;
  }
  return `<div class="${cls}" data-ch="${id}" data-i="${i}">
    <div class="chno">${bn(i + 1)}</div>
    <div class="rmain"><div class="rtitle">${esc(ch.title || 'অধ্যায়')}${sub}</div></div>
    ${right}</div>`;
}

function paintBookToolbar(book) {
  const bar = $('#bookbar'); const btn = $('#dlallbtn');
  if (!bar || !BookPage) return;
  const total = BookPage.chapters.length;
  let done = 0, active = 0, errs = 0;
  for (const ch of BookPage.chapters) {
    const id = String(ch.id);
    const st = S.dl.get(id);
    if (BookPage.saved.has(id) || st?.status === 'done') done++;
    else if (st?.status === 'downloading' || st?.status === 'queued') active++;
    else if (st?.status === 'error') errs++;
  }
  const pct = total ? Math.floor((done / total) * 100) : 0;
  bar.innerHTML = `<i class="${errs && !active ? 'err' : ''}" style="width:${pct}%"></i>`;
  bar.dataset.done = done; bar.dataset.total = total;
  if (btn) {
    btn.innerHTML = done >= total && total ? svgCheck + ' সম্পূর্ণ' : svgDownload + ` সব ডাউনলোড (${bn(done)}/${bn(total)})`;
    btn.disabled = done >= total && total;
  }
}

function wireRow(row, ch, book, i) {
  row._ch = ch; row._book = book; row._chIndex = i;
  row.onclick = (ev) => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    const id = String(ch.id);
    if (act === 'cancel') { DL.cancel(id); return; }
    if (act === 'read' || BookPage?.saved.has(id)) { openReader(id); return; }
    DL.enqueue(ch, book, { autoOpen: true });
  };
}

/* re-render a single chapter row + the book toolbar, if visible */
function updateChapterRow(id) {
  const row = $(`.row[data-ch="${id}"]`);
  if (!row) return;
  let { _ch: ch, _book: book, _chIndex: i } = row;
  if ((!ch || !book) && BookPage) {
    i = parseInt(row.dataset.i, 10);
    ch = BookPage.chapters[i]; book = BookPage.book;
  }
  if (!ch || !book) return;
  const st = S.dl.get(id);
  if (st?.status === 'done' && BookPage) {
    BookPage.saved.add(id);
    if (st.size) BookPage.sizes[id] = st.size;
  }
  row.outerHTML = chapterRowHtml(i, ch, book);
  const nr = $(`.row[data-ch="${id}"]`);
  if (nr) wireRow(nr, ch, book, i);
  paintBookToolbar(book);
}
DL.onRowUpdate = updateChapterRow;

export async function renderBook(bookId) {
  const ctx = S.bookCtx.get(String(bookId));
  const snap = await loadSnapshot();
  let bookName = ctx?.name, branchId = ctx?.branchId;
  if (!bookName) { // deep link: find in snapshot
    for (const b of snap.branches) {
      const f = b.books.find(x => String(x.id) === String(bookId));
      if (f) { bookName = f.name; branchId = b.id; break; }
    }
  }
  const branchLabel = snap.branches.find(b => b.id === branchId)?.label || '';
  $('#view').innerHTML = `<div class="page">
    ${viewHead(bookName || 'বই', branchLabel)}
    ${crumbs(branchLabel)}
    <div class="toolbar">
      <div class="bigbar" id="bookbar"><i style="width:0"></i></div>
      <button class="btn sm" id="dlallbtn">${svgDownload} সব ডাউনলোড</button>
    </div>
    <div class="list" id="rows"><div class="sk"></div><div class="sk"></div><div class="sk"></div></div>
  </div>`;
  let data;
  try { data = await getChapters(bookId); } catch (e) {
    $('#rows').innerHTML = `<div class="empty">${svgWarn}<div class="t">অধ্যায় তালিকা আনা যায়নি</div>
      <div>${e.status === 403 ? 'API কী বাতিল — সেটিংসে নতুন কী দিন।' : esc(e.message || 'নেটওয়ার্ক সমস্যা')}</div></div>`;
    return;
  }
  const metas = (await DB.allMeta()).filter(m => m.bookId === String(bookId));
  BookPage = {
    book: { id: String(bookId), name: bookName || 'বই', branchId },
    chapters: data.items,
    saved: new Set(metas.map(m => m.id)),
    sizes: Object.fromEntries(metas.map(m => [m.id, m.size || 0])),
  };
  $('#rows').innerHTML = (data.stale ? `<div class="banner warn">${svgOffline} অফলাইন — সংরক্ষিত তালিকা</div>` : '') +
    (data.items.length ? data.items.map((ch, i) => chapterRowHtml(i, ch, BookPage.book)).join('')
      : `<div class="empty">${svgPdf}<div class="t">এই বইয়ের কোনো অধ্যায় পাওয়া যায়নি</div></div>`);
  paintBookToolbar(BookPage.book);

  $$('#rows .row[data-ch]').forEach((row) => {
    const i = parseInt(row.dataset.i, 10);
    wireRow(row, BookPage.chapters[i], BookPage.book, i);
  });
  $('#dlallbtn').onclick = () => {
    let n = 0;
    for (const ch of BookPage.chapters) {
      const id = String(ch.id);
      if (!BookPage.saved.has(id) && !S.dl.has(id)) { DL.enqueue(ch, BookPage.book); n++; }
    }
    if (n) toast(`${bn(n)} অধ্যায় ডাউনলোড শুরু হয়েছে`);
  };
}
