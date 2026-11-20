/* catalog.ts — branches/books/chapters from the API, with offline caches
   and the bundled catalog-snapshot.json as last-resort fallback
   (the snapshot is a static JSON import — it rides inside the app bundle,
   so it works on any host and any base path, including GitHub Pages) */
import { S } from "./config";
import { apiGet } from "./net";
import type { Book, Chapter, ListResult, Snapshot } from "./types";
import snapshotJson from "./catalog-snapshot.json";

const SNAPSHOT: Snapshot = snapshotJson;

export function loadSnapshot(): Snapshot {
  S.snapshot ??= SNAPSHOT;
  return S.snapshot;
}

const catCache = {
  get<T>(k: string): { t: number; v: T } | null {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- JSON.parse boundary: entries are only ever written by set()
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
        /* still full — give up, the API just won't be cached */
      }
    }
  },
};

interface ApiEnvelope<T> {
  data?: T[];
  pagination?: { total_page?: string | number };
}

export async function getBooks(
  branchId: number | string,
): Promise<ListResult<Book>> {
  try {
    const d = await apiGet<ApiEnvelope<Book>>("categories", {
      parent: branchId,
      limit: 200,
    });
    const items = (d.data || []).toSorted(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );
    catCache.set(`books:${branchId}`, items);
    return { items, stale: false };
  } catch (e) {
    const c = catCache.get<Book[]>(`books:${branchId}`);
    if (c) return { items: c.v, stale: true };
    const snap = loadSnapshot();
    const b = snap.branches.find((x) => x.id === Number(branchId));
    if (b) return { items: b.books, stale: true };
    throw e;
  }
}

export async function getChapters(
  bookId: number | string,
): Promise<ListResult<Chapter>> {
  const cached = catCache.get<Chapter[]>(`chaps:${bookId}`);
  try {
    const items: Chapter[] = [];
    let page = 1;
    for (;;) {
      // eslint-disable-next-line no-await-in-loop -- pagination must stay sequential
      const d = await apiGet<ApiEnvelope<Chapter>>("books", {
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
    items.reverse(); // API returns newest first; app shows display order
    catCache.set(`chaps:${bookId}`, items);
    return { items, stale: false };
  } catch (e) {
    if (cached) return { items: cached.v, stale: true };
    throw e;
  }
}
