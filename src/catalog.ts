/* catalog.ts — branches/books/chapters: live API first, localStorage cache
   second, bundled snapshot last (offline). One service owns the catalog for
   the whole app (SSOT); views never walk the snapshot themselves. */

import { api, type ApiClient } from "./net";
import { NAME_FIXES } from "./lib/nameFixes";
import { compareChapters, parseTitle, withMathNames } from "./lib/titles";
import type { Book, Chapter, ListResult, Snapshot } from "./types";
import snapshotJson from "./catalog-snapshot.json";

export interface ApiEnvelope<T> {
  data?: T[];
  pagination?: { total_page?: string | number };
}

export interface BookRef {
  book: Book;
  branchId: number;
  branchLabel: string;
}

const catCache = {
  get<T>(k: string): { t: number; v: T } | null {
    try {
      // JSON.parse boundary: entries are only ever written by set()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      return JSON.parse(localStorage.getItem(`ptg:${k}`) || "null") as {
        t: number;
        v: T;
      } | null;
    } catch {
      return null;
    }
  },
  set<T>(k: string, v: T) {
    try {
      localStorage.setItem(`ptg:${k}`, JSON.stringify({ t: Date.now(), v }));
    } catch {
      /* quota: drop chapter caches first */
      for (const key of Object.keys(localStorage))
        if (key.startsWith("ptg:chaps:")) localStorage.removeItem(key);
      try {
        localStorage.setItem(`ptg:${k}`, JSON.stringify({ t: Date.now(), v }));
      } catch {
        /* still full — the API just won't be cached */
      }
    }
  },
};

const fixBookNames = (books: Book[]): Book[] =>
  books.map((b) =>
    NAME_FIXES[b.name] ? { ...b, name: NAME_FIXES[b.name] } : b,
  );

export class CatalogService {
  readonly snapshot: Snapshot;
  private readonly knownBooks = new Map<string, Book>(); // API books seen this session
  private readonly api: ApiClient;

  constructor(snapshot: Snapshot, apiClient: ApiClient = api) {
    this.snapshot = snapshot;
    this.api = apiClient;
  }

  /** A book by id, wherever it lives (remembered API books, then snapshot). */
  findBook(id: string | number): BookRef | null {
    const key = String(id);
    const known = this.knownBooks.get(key);
    if (known) {
      const branch = this.snapshot.branches.find(
        (b) => b.id === known.branchId,
      );
      return {
        book: known,
        branchId: known.branchId ?? 0,
        branchLabel: branch?.label ?? "",
      };
    }
    for (const branch of this.snapshot.branches) {
      const bk = branch.books.find((x) => String(x.id) === key);
      if (bk)
        return { book: bk, branchId: branch.id, branchLabel: branch.label };
    }
    return null;
  }

  /** Remember an API-sourced book so later views can resolve it. */
  rememberBook(book: Book): void {
    this.knownBooks.set(String(book.id), book);
  }

  /** Chapter count from the snapshot (used by the version chooser). */
  chapterCountOf(id: string | number): number {
    const list = this.findBook(id)?.book.chapterList;
    return Array.isArray(list) ? list.length : 0;
  }

  async getBooks(branchId: number | string): Promise<ListResult<Book>> {
    try {
      const d = await this.api.get<ApiEnvelope<Book>>("categories", {
        parent: branchId,
        limit: 200,
      });
      const items = fixBookNames(
        (d.data || []).toSorted((a, b) => (a.order ?? 0) - (b.order ?? 0)),
      );
      catCache.set(`books:${branchId}`, items);
      return { items, stale: false };
    } catch (e) {
      const c = catCache.get<Book[]>(`books:${branchId}`);
      if (c) return { items: fixBookNames(c.v), stale: true };
      const b = this.snapshot.branches.find((x) => x.id === Number(branchId));
      if (b) return { items: b.books, stale: true };
      throw e;
    }
  }

  /** Enrich raw API chapters with the parsed contract and order them. */
  private normalizeChapters(items: Chapter[], bookName = ""): Chapter[] {
    const enriched: Chapter[] = items.map((ch) => {
      // re-parse when unparsed, or when an older cache stored a nameless title
      if (ch.display && ch.display !== ch.label) return ch;
      const p = withMathNames(bookName, parseTitle(ch.title));
      const pages: [number, number] | null = p.pageStart
        ? [p.pageStart, p.pageEnd ?? p.pageStart]
        : null;
      return {
        ...ch,
        num: p.number,
        label: p.label,
        display: p.display,
        pages,
        kind: p.kind,
      };
    });
    return enriched
      .map((ch, i) => ({ ch, i, p: parseTitle(ch.title) }))
      .toSorted((x, y) => compareChapters(x.p, y.p) || x.i - y.i)
      .map((x) => x.ch);
  }

  private bookNameOf(bookId: number | string): string {
    return this.findBook(bookId)?.book.name ?? "";
  }

  async getChapters(bookId: number | string): Promise<ListResult<Chapter>> {
    const cached = catCache.get<Chapter[]>(`chaps:${bookId}`);
    try {
      const items: Chapter[] = [];
      let page = 1;
      for (;;) {
        // pagination must stay sequential
        // eslint-disable-next-line no-await-in-loop
        const d = await this.api.get<ApiEnvelope<Chapter>>("books", {
          category: bookId,
          limit: 300,
          page,
        });
        const batch = d.data || [];
        items.push(...batch);
        const p = d.pagination || {};
        if (
          page >= Number.parseInt(String(p.total_page || "1"), 10) ||
          !batch.length
        )
          break;
        page++;
      }
      // API rows come newest-first; the parser adapter decides the real order
      const sorted = this.normalizeChapters(items, this.bookNameOf(bookId));
      catCache.set(`chaps:${bookId}`, sorted);
      return { items: sorted, stale: false };
    } catch (e) {
      if (cached)
        return {
          items: this.normalizeChapters(cached.v, this.bookNameOf(bookId)),
          stale: true,
        };
      const bk = this.findBook(bookId)?.book;
      if (bk?.chapterList?.length)
        return { items: bk.chapterList, stale: true };
      throw e;
    }
  }
}

/* JSON import boundary: the file's inferred `kind: string` cannot prove the
   ChapterKind union — the values are produced by scripts/make-snapshot.ts. */
// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const SNAPSHOT = snapshotJson as Snapshot;

export const catalog = new CatalogService(SNAPSHOT);
