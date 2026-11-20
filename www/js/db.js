/* db.js — IndexedDB storage for downloaded chapter PDFs + metadata */

export const DB = (() => {
  let dbp = null;
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open('pathagar', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files');
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }
  const tx = async (stores, mode, fn) => {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(stores, mode);
      const out = fn(t);
      t.oncomplete = () => resolve(out?.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  };
  return {
    async putFile(id, buffer, meta) {
      await tx(['files', 'meta'], 'readwrite', (t) => {
        t.objectStore('files').put(new Blob([buffer], { type: 'application/pdf' }), id);
        t.objectStore('meta').put(meta, id);
      });
    },
    getFile: (id) => tx(['files'], 'readonly', (t) => t.objectStore('files').get(id)),
    getMeta: (id) => tx(['meta'], 'readonly', (t) => t.objectStore('meta').get(id)),
    async allMeta() {
      const db = await open();
      return new Promise((resolve, reject) => {
        const r = db.transaction('meta').objectStore('meta').getAll();
        r.onsuccess = () => resolve(r.result || []);
        r.onerror = () => reject(r.error);
      });
    },
    async delFile(id) {
      await tx(['files', 'meta'], 'readwrite', (t) => {
        t.objectStore('files').delete(id);
        t.objectStore('meta').delete(id);
      });
    },
    async clearAll() {
      await tx(['files', 'meta'], 'readwrite', (t) => {
        t.objectStore('files').clear();
        t.objectStore('meta').clear();
      });
    },
    async updateMeta(id, patch) {
      const m = await this.getMeta(id);
      if (m) await tx(['meta'], 'readwrite', (t) => t.objectStore('meta').put({ ...m, ...patch }, id));
    },
  };
})();
