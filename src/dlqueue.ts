/* dlqueue.ts — download manager (queue, concurrency, progress, cancel)
   UI decoupling: views inject callbacks instead of importing (avoids cycles)
     DL.onRowUpdate  = fn(chapterId)   — set by the book view, re-paints a row
     DL.openChapter  = fn(chapterId)   — set by main.ts, opens the reader */
import { S } from "./config";
import { errMessage, errStatus } from "./utils";
import { downloadPdf, pdfFetchUrl } from "./net";
import { DB } from "./db";
import type { Book, Chapter, DlState } from "./types";

export interface DlJob {
  chapter: Chapter;
  book: Book;
}

interface DLApi {
  queue: DlJob[];
  active: number;
  onRowUpdate: ((chapterId: string) => void) | null;
  openChapter: ((chapterId: string) => void) | null;
  persistAsked: boolean;
  enqueue(chapter: Chapter, book: Book, opts?: { autoOpen?: boolean }): void;
  cancel(id: string): void;
  pump(): void;
  run(job: DlJob): Promise<void>;
}

export const DL: DLApi = {
  queue: [],
  active: 0,
  onRowUpdate: null,
  openChapter: null,
  persistAsked: false,

  enqueue(chapter, book, { autoOpen = false } = {}) {
    const id = String(chapter.id);
    if (S.dl.has(id)) {
      if (autoOpen) S.autoOpen.add(id);
      return;
    }
    S.dl.set(id, { status: "queued", pct: 0, loaded: 0, total: 0 });
    if (autoOpen) S.autoOpen.add(id);
    this.queue.push({ chapter, book });
    this.pump();
    this.onRowUpdate?.(id);
  },

  cancel(id) {
    const st = S.dl.get(id);
    if (!st) return;
    st.abort?.abort();
    if (st.status === "queued") {
      this.queue = this.queue.filter((j) => String(j.chapter.id) !== id);
      S.dl.delete(id);
      this.onRowUpdate?.(id);
    } else {
      st.cancelled = true;
    }
  },

  pump() {
    while (
      this.active < Math.max(1, Math.min(4, S.settings.concurrency)) &&
      this.queue.length
    ) {
      const job = this.queue.shift();
      if (!job) break;
      this.active++;
      void this.run(job).finally(() => {
        this.active--;
        this.pump();
      });
    }
  },

  async run({ chapter, book }) {
    const id = String(chapter.id);
    const abort = new AbortController();
    const st: DlState = S.dl.get(id) || {
      status: "queued",
      pct: 0,
      loaded: 0,
      total: 0,
    };
    S.dl.set(id, st);
    Object.assign(st, {
      status: "downloading",
      pct: 0,
      loaded: 0,
      total: 0,
      abort,
      bookId: String(book.id),
    });
    this.onRowUpdate?.(id);
    let lastPaint = 0;
    try {
      const buf = await downloadPdf(pdfFetchUrl(chapter.pdf), {
        signal: abort.signal,
        onProgress: (loaded, total) => {
          st.loaded = loaded;
          st.total = total;
          st.pct = total ? Math.floor((loaded / total) * 100) : 0;
          const now = performance.now();
          if (now - lastPaint > 120) {
            lastPaint = now;
            this.onRowUpdate?.(id);
          }
        },
      });
      await DB.putFile(id, buf, {
        id,
        title: chapter.title || "Chapter",
        bookId: String(book.id),
        bookName: book.name,
        branchId: String(book.branchId || ""),
        url: chapter.pdf,
        size: buf.byteLength,
        addedAt: Date.now(),
        lastOpened: 0,
      });
      st.status = "done";
      st.pct = 100;
      st.size = buf.byteLength;
      this.onRowUpdate?.(id);
      if (!this.persistAsked) {
        this.persistAsked = true;
        navigator.storage?.persist?.().catch(() => {});
      }
      if (S.autoOpen.has(id)) {
        S.autoOpen.delete(id);
        this.openChapter?.(id);
      }
    } catch (e) {
      if ((e instanceof Error && e.name === "AbortError") || st.cancelled) {
        S.dl.delete(id);
      } else {
        st.status = "error";
        st.error =
          errStatus(e) === 403
            ? "Key changed? (403)"
            : errMessage(e) || "Failed";
      }
      this.onRowUpdate?.(id);
    }
  },
};
