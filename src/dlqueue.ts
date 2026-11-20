/* dlqueue.ts — download manager (queue, concurrency, progress, speed, cancel)
   UI decoupling: views inject callbacks instead of importing (avoids cycles)
     DL.onRowUpdate  = fn(chapterId)   — set by useDlVersion, re-paints rows
     DL.openChapter  = fn(chapterId)   — set by main.ts, opens the reader
   Speed: a rolling ~4 s byte window per job, recomputed on progress events AND
   on a 500 ms tick while jobs run (so speed/ETA decay to 0 when the network
   stalls instead of freezing at the last value). */
import { DL_CONCURRENCY, S } from "./config";
import { errMessage, errStatus } from "@/lib/errors";
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
  /** every job ever enqueued this session (for the downloads popup) */
  jobs: Map<string, DlJob>;
  onRowUpdate: ((chapterId: string) => void) | null;
  openChapter: ((chapterId: string) => void) | null;
  /** fires on every user-initiated enqueue — the app opens the downloads popup */
  onEnqueue: ((chapterId: string) => void) | null;
  persistAsked: boolean;
  enqueue(chapter: Chapter, book: Book, opts?: { autoOpen?: boolean }): void;
  cancel(id: string): void;
  cancelAll(): void;
  retry(id: string): void;
  pump(): void;
  run(job: DlJob): Promise<void>;
  /** aggregate stats for the downloads popup */
  stats(): {
    downloading: number;
    queued: number;
    errors: number;
    speed: number; // bytes/s across active jobs
    doneThisSession: number;
  };
}

/* rolling speed window (bytes per second over the last WINDOW ms) */
const WINDOW = 4000;
interface Sample {
  t: number;
  loaded: number;
}
const samples = new Map<string, Sample[]>();

function rollingSpeed(
  id: string,
  loaded: number,
  now = performance.now(),
): number {
  let arr = samples.get(id);
  if (!arr) {
    arr = [];
    samples.set(id, arr);
  }
  arr.push({ t: now, loaded });
  while (arr.length > 1 && now - arr[0].t > WINDOW) arr.shift();
  const first = arr[0];
  const dt = (now - first.t) / 1000;
  return dt >= 0.5 ? Math.max(0, (loaded - first.loaded) / dt) : 0;
}

/* keep speed/ETA ticking even when no bytes arrive (stalled network) */
let ticker: ReturnType<typeof setInterval> | null = null;
function ensureTicker() {
  if (ticker || typeof setInterval === "undefined") return;
  ticker = setInterval(() => {
    let any = false;
    for (const [id, st] of S.dl) {
      if (st.status === "downloading") {
        any = true;
        st.speed = rollingSpeed(id, st.loaded);
        DL.onRowUpdate?.(id);
      }
    }
    if (!any && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  }, 500);
}

export const DL: DLApi = {
  queue: [],
  active: 0,
  jobs: new Map(),
  onRowUpdate: null,
  openChapter: null,
  onEnqueue: null,
  persistAsked: false,

  enqueue(chapter, book, { autoOpen = false } = {}) {
    const id = String(chapter.id);
    this.jobs.set(id, { chapter, book });
    if (S.dl.has(id)) {
      if (autoOpen) S.autoOpen.add(id);
      return;
    }
    S.dl.set(id, { status: "queued", pct: 0, loaded: 0, total: 0 });
    if (autoOpen) S.autoOpen.add(id);
    this.queue.push({ chapter, book });
    this.pump();
    ensureTicker();
    this.onRowUpdate?.(id);
    this.onEnqueue?.(id);
  },

  cancel(id) {
    const st = S.dl.get(id);
    if (!st) return;
    st.abort?.abort();
    if (st.status === "queued") {
      this.queue = this.queue.filter((j) => String(j.chapter.id) !== id);
      S.dl.delete(id);
    } else {
      st.cancelled = true;
    }
    this.onRowUpdate?.(id);
  },

  cancelAll() {
    for (const [id, st] of S.dl) {
      if (st.status === "downloading" || st.status === "queued")
        this.cancel(id);
    }
  },

  retry(id) {
    const job = this.jobs.get(id);
    if (!job) return;
    S.dl.delete(id);
    this.onRowUpdate?.(id);
    this.enqueue(job.chapter, job.book);
  },

  pump() {
    while (
      this.active < Math.max(1, Math.min(4, DL_CONCURRENCY)) &&
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

  /* toolbar meter lives in the Book view: completed chapters + in-flight byte
     progress — a "finished-chapters-only" bar sits at 0% for minutes on slow
     networks, which is exactly the broken download meter users reported */

  stats() {
    let downloading = 0;
    let queued = 0;
    let errors = 0;
    let speed = 0;
    let doneThisSession = 0;
    for (const st of S.dl.values()) {
      if (st.status === "downloading") {
        downloading++;
        speed += st.speed ?? 0;
      } else if (st.status === "queued") queued++;
      else if (st.status === "error") errors++;
      else if (st.status === "done") doneThisSession++;
    }
    return { downloading, queued, errors, speed, doneThisSession };
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
      speed: 0,
      abort,
      bookId: String(book.id),
    });
    samples.delete(id);
    this.onRowUpdate?.(id);
    let lastPaint = 0;
    try {
      const buf = await downloadPdf(pdfFetchUrl(chapter.pdf), {
        signal: abort.signal,
        onProgress: (loaded, total) => {
          st.loaded = loaded;
          st.total = total;
          // cap at 99 until the file is stored — a total mismatch must never
          // paint 100% while bytes are still arriving
          st.pct = total ? Math.min(99, Math.floor((loaded / total) * 100)) : 0;
          st.speed = rollingSpeed(id, loaded);
          const now = performance.now();
          if (now - lastPaint > 120) {
            lastPaint = now;
            this.onRowUpdate?.(id);
          }
        },
      });
      await DB.putFile(id, buf, {
        id,
        title: chapter.display || chapter.title || "Chapter",
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
      st.speed = 0;
      samples.delete(id);
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
      samples.delete(id);
      st.speed = 0;
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
