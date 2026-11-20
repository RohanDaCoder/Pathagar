/* catalog.js — branches/books/chapters from the API, with offline caches
   and the bundled catalog-snapshot.json as last-resort fallback */
import { S } from './config.js';
import { apiGet } from './net.js';

export async function loadSnapshot() {
  if (S.snapshot) return S.snapshot;
  try {
    S.snapshot = await (await fetch('catalog-snapshot.json')).json();
  } catch { S.snapshot = { branches: [] }; }
  return S.snapshot;
}

const catCache = {
  get(k) { try { return JSON.parse(localStorage.getItem('ptg:' + k) || 'null'); } catch { return null; } },
  set(k, v) {
    try { localStorage.setItem('ptg:' + k, JSON.stringify({ t: Date.now(), v })); }
    catch { /* quota: drop chapter caches first */
      for (const key of Object.keys(localStorage)) if (key.startsWith('ptg:chaps:')) localStorage.removeItem(key);
      try { localStorage.setItem('ptg:' + k, JSON.stringify({ t: Date.now(), v })); } catch {}
    }
  },
};

export async function getBooks(branchId) {
  try {
    const d = await apiGet('categories', { parent: branchId, limit: 200 });
    const items = (d.data || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    catCache.set('books:' + branchId, items);
    return { items, stale: false };
  } catch (e) {
    const c = catCache.get('books:' + branchId);
    if (c) return { items: c.v, stale: true };
    const snap = await loadSnapshot();
    const b = snap.branches.find(x => x.id === branchId);
    if (b) return { items: b.books.map(x => ({ ...x, name: x.name })), stale: true };
    throw e;
  }
}

export async function getChapters(bookId) {
  const cached = catCache.get('chaps:' + bookId);
  try {
    const items = [];
    let page = 1;
    for (;;) {
      const d = await apiGet('books', { category: bookId, limit: 300, page });
      const batch = d.data || [];
      items.push(...batch);
      const p = d.pagination || {};
      if (page >= parseInt(p.total_page || '1', 10) || !batch.length) break;
      page++;
    }
    items.reverse(); // API returns newest first; app shows display order
    catCache.set('chaps:' + bookId, items);
    return { items, stale: false };
  } catch (e) {
    if (cached) return { items: cached.v, stale: true };
    throw e;
  }
}
