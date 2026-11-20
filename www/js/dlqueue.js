/* dlqueue.js — download manager (queue, concurrency, progress, cancel)
   UI decoupling: views inject callbacks instead of importing (avoids cycles)
     DL.onRowUpdate  = fn(chapterId)   — set by the book view, re-paints a row
     DL.openChapter  = fn(chapterId)   — set by main.js, opens the reader */
import { S } from './config.js';
import { downloadPdf, pdfFetchUrl } from './net.js';
import { DB } from './db.js';

export const DL = {
  queue: [], active: 0,
  onRowUpdate: null,
  openChapter: null,
  persistAsked: false,

  enqueue(chapter, book, { autoOpen = false } = {}) {
    const id = String(chapter.id);
    if (S.dl.has(id)) { if (autoOpen) S.autoOpen.add(id); return; }
    S.dl.set(id, { status: 'queued', pct: 0, loaded: 0, total: 0 });
    if (autoOpen) S.autoOpen.add(id);
    this.queue.push({ chapter, book });
    this.pump();
    this.onRowUpdate?.(id);
  },

  cancel(id) {
    const st = S.dl.get(id);
    if (!st) return;
    if (st.abort) st.abort.abort();
    if (st.status === 'queued') {
      this.queue = this.queue.filter(j => String(j.chapter.id) !== id);
      S.dl.delete(id);
      this.onRowUpdate?.(id);
    } else { st.cancelled = true; }
  },

  cancelAllOf(bookId) {
    for (const [id, st] of S.dl) {
      const job = this.queue.find(j => String(j.chapter.id) === id);
      if ((job && String(job.book.id) === String(bookId)) || (st.bookId === String(bookId))) this.cancel(id);
    }
  },

  pump() {
    while (this.active < Math.max(1, Math.min(4, S.settings.concurrency)) && this.queue.length) {
      const job = this.queue.shift();
      this.active++;
      this.run(job).finally(() => { this.active--; this.pump(); });
    }
  },

  async run({ chapter, book }) {
    const id = String(chapter.id);
    const abort = new AbortController();
    const st = S.dl.get(id) || {};
    Object.assign(st, { status: 'downloading', pct: 0, loaded: 0, total: 0, abort, bookId: String(book.id) });
    this.onRowUpdate?.(id);
    let lastPaint = 0;
    try {
      const buf = await downloadPdf(pdfFetchUrl(chapter.pdf), {
        signal: abort.signal,
        onProgress: (loaded, total) => {
          st.loaded = loaded; st.total = total;
          st.pct = total ? Math.floor((loaded / total) * 100) : 0;
          const now = performance.now();
          if (now - lastPaint > 120) { lastPaint = now; this.onRowUpdate?.(id); }
        },
      });
      await DB.putFile(id, buf, {
        id, title: chapter.title || 'অধ্যায়',
        bookId: String(book.id), bookName: book.name, branchId: String(book.branchId || ''),
        url: chapter.pdf, size: buf.byteLength, addedAt: Date.now(), lastOpened: 0,
      });
      st.status = 'done'; st.pct = 100; st.size = buf.byteLength;
      this.onRowUpdate?.(id);
      if (!this.persistAsked) { this.persistAsked = true; navigator.storage?.persist?.().catch(() => {}); }
      if (S.autoOpen.has(id)) { S.autoOpen.delete(id); this.openChapter?.(id); }
    } catch (e) {
      if (e?.name === 'AbortError' || st.cancelled) { S.dl.delete(id); }
      else { st.status = 'error'; st.error = e?.status === 403 ? 'কী পরিবর্তন হয়েছে? (403)' : (e.message || 'ব্যর্থ'); }
      this.onRowUpdate?.(id);
    }
  },
};
