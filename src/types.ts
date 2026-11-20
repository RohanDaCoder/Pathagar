/* types.ts — shared domain types */

import type { ChapterKind, ParsedTitle } from "./lib/titles";

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

/* Raw API chapter, enriched by the title parser adapter (lib/titles.ts).
   `title` stays the raw API value; the parsed fields drive display & order. */
export interface Chapter {
  id: number | string;
  title?: string;
  pdf: string;
  order?: number;
  /* parsed (present on chapters from getChapters and the snapshot) */
  num?: number | null;
  label?: string | null;
  display?: string;
  pages?: [number, number] | null;
  kind?: ChapterKind;
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
  /** rolling speed estimate in bytes/s (set by the queue while downloading) */
  speed?: number;
}

export interface BookCtx {
  id: string;
  name: string;
  branchId?: number;
}

export type { ParsedTitle, ChapterKind };
