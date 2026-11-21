/* db.ts — IndexedDB storage for downloaded chapter PDFs + metadata. */

import type { ChapterMeta } from "./types";

type TxResult<T> = IDBRequest<T> | undefined;

/** Tell the UI the file set changed — the Last Read tab re-checks whether
    its chapter is still downloaded, and the DL queue drops 'done' states
    for deleted files (book rows would otherwise navigate straight to a
    reader for a file that no longer exists). No-op under `bun test`. */
export type DbChange = { kind: "put" | "del" | "clear"; id?: string };

function notifyDbChange(detail: DbChange) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<DbChange>("ptg:db", { detail }));
}

/** Subscribe to file-set changes; returns an unsubscribe function. */
export function onDbChange(fn: (d: DbChange) => void): () => void {
  const h = (e: Event) =>
    // every ptg:db event comes from notifyDbChange, so detail is a DbChange
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    fn((e as CustomEvent<DbChange>).detail);
  window.addEventListener("ptg:db", h);
  return () => window.removeEventListener("ptg:db", h);
}

export class ChapterStore {
  private dbp: Promise<IDBDatabase> | undefined;

  private open(): Promise<IDBDatabase> {
    this.dbp ??= new Promise((resolve, reject) => {
      const req = indexedDB.open("pathagar", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("files"))
          db.createObjectStore("files");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbp;
  }

  private tx<T>(
    stores: string[],
    mode: IDBTransactionMode,
    fn: (t: IDBTransaction) => TxResult<T>,
  ): Promise<T | undefined> {
    return this.open().then(
      (db) =>
        new Promise<T | undefined>((resolve, reject) => {
          const t = db.transaction(stores, mode);
          const out = fn(t);
          t.oncomplete = () =>
            resolve(out && "result" in out ? out.result : undefined);
          t.onerror = () => reject(t.error);
          t.onabort = () => reject(t.error);
        }),
    );
  }

  async putFile(id: string, buffer: Uint8Array, meta: ChapterMeta) {
    await this.tx(["files", "meta"], "readwrite", (t) => {
      t.objectStore("files").put(
        // TS lib gap: Uint8Array<ArrayBufferLike> is a valid BlobPart at runtime
        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        new Blob([buffer as BlobPart], { type: "application/pdf" }),
        id,
      );
      t.objectStore("meta").put(meta, id);
    });
    notifyDbChange({ kind: "put", id });
  }

  getFile(id: string) {
    return this.tx<Blob | undefined>(["files"], "readonly", (t) =>
      t.objectStore("files").get(id),
    );
  }

  getMeta(id: string) {
    return this.tx<ChapterMeta | undefined>(["meta"], "readonly", (t) =>
      t.objectStore("meta").get(id),
    );
  }

  async allMeta(): Promise<ChapterMeta[]> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const r = db.transaction("meta").objectStore("meta").getAll();
      // the store only ever holds ChapterMeta
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      r.onsuccess = () => resolve((r.result as ChapterMeta[]) || []);
      r.onerror = () => reject(r.error);
    });
  }

  async delFile(id: string) {
    await this.tx(["files", "meta"], "readwrite", (t) => {
      t.objectStore("files").delete(id);
      t.objectStore("meta").delete(id);
    });
    notifyDbChange({ kind: "del", id });
  }

  async clearAll() {
    await this.tx(["files", "meta"], "readwrite", (t) => {
      t.objectStore("files").clear();
      t.objectStore("meta").clear();
    });
    notifyDbChange({ kind: "clear" });
  }

  async updateMeta(id: string, patch: Partial<ChapterMeta>) {
    const m = await this.getMeta(id);
    if (m)
      await this.tx(["meta"], "readwrite", (t) =>
        t.objectStore("meta").put({ ...m, ...patch }, id),
      );
  }
}

export const DB = new ChapterStore();
