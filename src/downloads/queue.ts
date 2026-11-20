/* downloads/queue.ts — download manager: queue, concurrency, progress,
   rolling-speed estimate, cancel. The queue lives outside React (downloads
   continue while navigating) and owns its own state; React views subscribe
   through useDlVersion (useSyncExternalStore). */

import { DL_CONCURRENCY } from "@/config";
import { errMessage, errStatus } from "@/lib/errors";
import { downloadPdf, pdfFetchUrl } from "@/net";
import { DB } from "@/db";
import type { Book, Chapter, DlState } from "@/types";

export interface DlJob {
  chapter: Chapter;
  book: Book;
}

const WINDOW = 4000; // rolling speed window, ms

export class DownloadQueue {
  /** every job ever enqueued this session (for the downloads popup) */
  readonly jobs = new Map<string, DlJob>();
  /** set by main.tsx — opens a finished chapter in the reader */
  openChapter: (chapterId: string) => void = () => {};
  /** fires on user-initiated enqueue — the app opens the downloads popup */
  onEnqueue: (chapterId: string) => void = () => {};

  #queue: DlJob[] = [];
  #active = 0;
  #states = new Map<string, DlState>();
  #autoOpen = new Set<string>();
  #samples = new Map<string, { t: number; loaded: number }[]>();
  #listeners = new Set<() => void>();
  #version = 0;
  #ticker: ReturnType<typeof setInterval> | null = null;
  #persistAsked = false;

  get version(): number {
    return this.#version;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  stateOf(id: string): DlState | undefined {
    return this.#states.get(id);
  }

  has(id: string): boolean {
    return this.#states.has(id);
  }

  /** every live download state (meter, popup, beforeunload guard). */
  states(): DlState[] {
    return [...this.#states.values()];
  }

  entries(): IterableIterator<[string, DlState]> {
    return this.#states.entries();
  }

  busy(): boolean {
    return this.states().some(
      (s) => s.status === "downloading" || s.status === "queued",
    );
  }

  #emit() {
    this.#version++;
    for (const l of this.#listeners) l();
  }

  #rollingSpeed(id: string, loaded: number, now = performance.now()): number {
    const arr = this.#samples.get(id) ?? [];
    arr.push({ t: now, loaded });
    this.#samples.set(id, arr);
    while (arr.length > 1 && now - arr[0].t > WINDOW) arr.shift();
    const dt = (now - arr[0].t) / 1000;
    return dt >= 0.5 ? Math.max(0, (loaded - arr[0].loaded) / dt) : 0;
  }

  /* keep speed ticking even when no bytes arrive (stalled network) */
  #ensureTicker() {
    if (this.#ticker || typeof setInterval === "undefined") return;
    this.#ticker = setInterval(() => {
      let any = false;
      for (const [id, st] of this.#states) {
        if (st.status === "downloading") {
          any = true;
          st.speed = this.#rollingSpeed(id, st.loaded);
          this.#emit();
        }
      }
      if (!any && this.#ticker) {
        clearInterval(this.#ticker);
        this.#ticker = null;
      }
    }, 500);
  }

  enqueue(chapter: Chapter, book: Book, { autoOpen = false } = {}) {
    const id = String(chapter.id);
    this.jobs.set(id, { chapter, book });
    if (this.#states.has(id)) {
      if (autoOpen) this.#autoOpen.add(id);
      return;
    }
    this.#states.set(id, { status: "queued", pct: 0, loaded: 0, total: 0 });
    if (autoOpen) this.#autoOpen.add(id);
    this.#queue.push({ chapter, book });
    this.#pump();
    this.#ensureTicker();
    this.#emit();
    this.onEnqueue(id);
  }

  cancel(id: string) {
    const st = this.#states.get(id);
    if (!st) return;
    st.abort?.abort();
    if (st.status === "queued") {
      this.#queue = this.#queue.filter((j) => String(j.chapter.id) !== id);
      this.#states.delete(id);
    } else {
      st.cancelled = true;
    }
    this.#emit();
  }

  cancelAll() {
    for (const [id, st] of this.#states) {
      if (st.status === "downloading" || st.status === "queued")
        this.cancel(id);
    }
  }

  retry(id: string) {
    const job = this.jobs.get(id);
    if (!job) return;
    this.#states.delete(id);
    this.#emit();
    this.enqueue(job.chapter, job.book);
  }

  #pump() {
    while (
      this.#active < Math.max(1, Math.min(4, DL_CONCURRENCY)) &&
      this.#queue.length
    ) {
      const job = this.#queue.shift();
      if (!job) break;
      this.#active++;
      void this.#run(job).finally(() => {
        this.#active--;
        this.#pump();
      });
    }
  }

  /** aggregate stats for the downloads popup */
  stats() {
    let downloading = 0;
    let queued = 0;
    let errors = 0;
    let speed = 0;
    let doneThisSession = 0;
    for (const st of this.#states.values()) {
      if (st.status === "downloading") {
        downloading++;
        speed += st.speed ?? 0;
      } else if (st.status === "queued") queued++;
      else if (st.status === "error") errors++;
      else if (st.status === "done") doneThisSession++;
    }
    return { downloading, queued, errors, speed, doneThisSession };
  }

  async #run({ chapter, book }: DlJob) {
    const id = String(chapter.id);
    const abort = new AbortController();
    const st: DlState = this.#states.get(id) || {
      status: "queued",
      pct: 0,
      loaded: 0,
      total: 0,
    };
    this.#states.set(id, st);
    Object.assign(st, {
      status: "downloading",
      pct: 0,
      loaded: 0,
      total: 0,
      speed: 0,
      abort,
      bookId: String(book.id),
    });
    this.#samples.delete(id);
    this.#emit();
    let lastPaint = 0;
    try {
      const buf = await downloadPdf(pdfFetchUrl(chapter.pdf), {
        signal: abort.signal,
        onProgress: (loaded, total) => {
          st.loaded = loaded;
          st.total = total;
          // cap at 99 until stored — a total mismatch must never paint 100%
          st.pct = total ? Math.min(99, Math.floor((loaded / total) * 100)) : 0;
          st.speed = this.#rollingSpeed(id, loaded);
          const now = performance.now();
          if (now - lastPaint > 120) {
            lastPaint = now;
            this.#emit();
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
      this.#samples.delete(id);
      this.#emit();
      if (!this.#persistAsked) {
        this.#persistAsked = true;
        navigator.storage?.persist?.().catch(() => {});
      }
      if (this.#autoOpen.has(id)) {
        this.#autoOpen.delete(id);
        this.openChapter(id);
      }
    } catch (e) {
      this.#samples.delete(id);
      st.speed = 0;
      if ((e instanceof Error && e.name === "AbortError") || st.cancelled) {
        this.#states.delete(id);
      } else {
        st.status = "error";
        st.error =
          errStatus(e) === 403
            ? "Key changed? (403)"
            : errMessage(e) || "Failed";
      }
      this.#emit();
    }
  }
}
