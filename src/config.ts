/* config.ts — app constants + user settings.
   The five values under "porting config" are the only things to change when
   re-pointing the app at a different backend or host. */

export const APP_NAME = "Pathagar";
export const APP_VERSION = "1.9.3";

/** The original app's Laravel backend. */
export const API_URL = "https://books.tetashweb.xyz/api/v1/app/";
/** Hardcoded app key the original APK ships with (403 without it). */
export const API_KEY =
  "qbznP4XjGALmagvQOOlN5zVZmcovJfHPE1a3xHmPnV2B9eQz52yC3wm7nVbqqyG3";
/** Web PDF reverse proxy path — netlify.toml / public/_redirects forward
    /pdf/* to pdf.tetashweb.xyz (the PDF host sends no CORS headers). */
export const PDF_PROXY_PREFIX = "/pdf/";
/** Chapters downloaded at the same time. */
export const DL_CONCURRENCY = 2;

/* ── user settings (appearance only) ───────────────────────────────────── */

export interface Settings {
  theme: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "auto",
};

/** localStorage is absent under `bun test` and can throw in private mode */
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

/** The live settings object (mutate + saveSettings() to persist). */
export const settings = loadSettings();

export function saveSettings() {
  if (typeof localStorage !== "undefined")
    localStorage.setItem("ptg:settings", JSON.stringify(settings));
}
