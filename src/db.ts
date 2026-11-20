/* db.ts — IndexedDB storage for downloaded chapter PDFs + metadata */
import type { ChapterMeta } from "./types";

let dbp: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("pathagar", 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

type TxResult<T> = IDBRequest<T> | undefined;

function tx<T>(
  stores: string[],
  mode: IDBTransactionMode,
  fn: (t: IDBTransaction) => TxResult<T>,
): Promise<T | undefined> {
  return open().then(
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

export const DB = {
  async putFile(id: string, buffer: Uint8Array, meta: ChapterMeta) {
    await tx(["files", "meta"], "readwrite", (t) => {
      t.objectStore("files").put(
        new Blob([buffer as BlobPart], { type: "application/pdf" }),
        id,
      );
      t.objectStore("meta").put(meta, id);
    });
  },
  getFile: (id: string) =>
    tx<Blob | undefined>(["files"], "readonly", (t) =>
      t.objectStore("files").get(id),
    ) as Promise<Blob | undefined>,
  getMeta: (id: string) =>
    tx<ChapterMeta | undefined>(["meta"], "readonly", (t) =>
      t.objectStore("meta").get(id),
    ) as Promise<ChapterMeta | undefined>,
  async allMeta(): Promise<ChapterMeta[]> {
    const db = await open();
    return new Promise((resolve, reject) => {
      const r = db.transaction("meta").objectStore("meta").getAll();
      r.onsuccess = () => resolve((r.result as ChapterMeta[]) || []);
      r.onerror = () => reject(r.error);
    });
  },
  async delFile(id: string) {
    await tx(["files", "meta"], "readwrite", (t) => {
      t.objectStore("files").delete(id);
      t.objectStore("meta").delete(id);
    });
  },
  async clearAll() {
    await tx(["files", "meta"], "readwrite", (t) => {
      t.objectStore("files").clear();
      t.objectStore("meta").clear();
    });
  },
  async updateMeta(id: string, patch: Partial<ChapterMeta>) {
    const m = await DB.getMeta(id);
    if (m)
      await tx(["meta"], "readwrite", (t) =>
        t.objectStore("meta").put({ ...m, ...patch }, id),
      );
  },
};
