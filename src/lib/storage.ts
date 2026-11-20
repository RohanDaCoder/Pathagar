/* lib/storage.ts — storage estimate (kept out of views for testability) */

export interface StorageEstimateInfo {
  usage: number;
  quota: number;
}

export async function storageEstimate(): Promise<StorageEstimateInfo | null> {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? { usage: e.usage || 0, quota: e.quota || 0 } : null;
  } catch {
    return null;
  }
}
