/* config.ts — platform detection, the porting config, settings, shared state.

   ── PORTING CONFIG ──────────────────────────────────────────────────────────
   The three values below are the ONLY things to change when re-pointing the
   app at a different backend or host. They used to live in the Settings UI;
   they are code constants now (non-technical users can no longer break the
   app, and the values travel with the repo when we port it). */
import type { BookCtx, DlState, Snapshot } from "./types";

export const APP_NAME = "Pathagar";
export const APP_VERSION = "1.7.0";

/** The original app's Laravel backend (Stage-1 report). */
export const API_URL = "https://books.tetashweb.xyz/api/v1/app/";
/** Hardcoded app key the original APK ships with (403 without it). */
export const API_KEY =
  "qbznP4XjGALmagvQOOlN5zVZmcovJfHPE1a3xHmPnV2B9eQz52yC3wm7nVbqqyG3";
/** Web PDF reverse proxy path: netlify.toml / public/_redirects forward
 * /pdf/* to pdf.tetashweb.xyz (the PDF host sends no CORS headers). */
export const PDF_PROXY_PREFIX = "/pdf/";
/** Chapters downloaded at the same time. */
export const DL_CONCURRENCY = 2;

/* ── user settings (appearance only) ─────────────────────────────────────── */
export interface Settings {
  theme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "auto",
};

/* localStorage is absent under `bun test` and can throw in private mode */
function loadSettings(): Settings {
  const s = { ...DEFAULT_SETTINGS };
  let raw: string | null = null;
  try {
    raw =
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem("ptg:settings");
  } catch {
    /* storage unavailable — defaults are fine */
  }
  if (!raw) return s;
  try {
    const parsed: unknown = JSON.parse(raw);
    const theme =
      typeof parsed === "object" && parsed !== null
        ? Reflect.get(parsed, "theme")
        : null;
    if (typeof theme === "string") s.theme = theme;
  } catch {
    /* corrupted settings — fall back to defaults */
  }
  return s;
}

/* app-wide mutable state (single source of truth) */
export const S = {
  settings: loadSettings(),
  snapshot: null as Snapshot | null, // bundled offline catalog (loaded in catalog.ts)
  route: { name: "home", args: [] as string[] },
  dl: new Map<string, DlState>(), // chapterId -> download state
  autoOpen: new Set<string>(), // chapter ids to open when download finishes
  bookCtx: new Map<string, BookCtx>(), // bookId -> {id, name, branchId}
};

export function saveSettings() {
  if (typeof localStorage !== "undefined")
    localStorage.setItem("ptg:settings", JSON.stringify(S.settings));
}
