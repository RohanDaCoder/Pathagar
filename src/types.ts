/* types.ts — shared domain types */

export interface Branch {
  id: number;
  label: string;
  total_chapters: number;
  books: Book[];
}

export interface Book {
  id: number | string;
  name: string;
  image?: string;
  chapters?: number;
  order?: number;
  branchId?: number; // set by the branch/book views when queuing downloads
}

export interface Chapter {
  id: number | string;
  title?: string;
  pdf: string;
  order?: number;
}

export interface ChapterMeta {
  id: string;
  title: string;
  bookId: string;
  bookName: string;
  branchId: string;
  url: string;
  size: number;
  addedAt: number;
  lastOpened: number;
}

export interface Snapshot {
  generated?: string;
  source?: string;
  branches: Branch[];
}

export interface ListResult<T> {
  items: T[];
  stale: boolean;
}

export type DlStatus = "queued" | "downloading" | "done" | "error";

export interface DlState {
  status: DlStatus;
  pct: number;
  loaded: number;
  total: number;
  size?: number;
  error?: string;
  abort?: AbortController;
  cancelled?: boolean;
  bookId?: string;
}

export interface UpdateInfo {
  current: string;
  latest: string;
  apkUrl: string;
  htmlUrl: string;
  notes: string;
  skipped: boolean;
}

export interface BookCtx {
  id: string;
  name: string;
  branchId?: number;
}
