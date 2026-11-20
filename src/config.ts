/* config.ts — platform detection, settings, shared app state */
import { Capacitor } from "@capacitor/core";
import type { BookCtx, DlState, Snapshot } from "./types";

export const NATIVE = Capacitor.isNativePlatform();
export const APP_NAME = "Pathagar";
export const APP_VERSION = "1.1.0";
export const REPO = "RohanDaCoder/Pathagar"; // releases feed the in-app updater

export interface Settings {
  apiUrl: string;
  apiKey: string;
  proxyPrefix: string; // web: same-origin Netlify proxy path
  proxyEnabled: boolean; // native downloads directly (no CORS in native http)
  theme: string;
  concurrency: number;
}

export const DEFAULT_SETTINGS: Settings = {
  apiUrl: "https://books.tetashweb.xyz/api/v1/app/",
  apiKey: "qbznP4XjGALmagvQOOlN5zVZmcovJfHPE1a3xHmPnV2B9eQz52yC3wm7nVbqqyG3",
  proxyPrefix: "/pdf/",
  proxyEnabled: !NATIVE,
  theme: "auto",
  concurrency: 2,
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
    if (typeof parsed === "object" && parsed !== null) {
      for (const [k, v] of Object.entries(
        parsed as Record<string, unknown>, // eslint-disable-line @typescript-eslint/no-unsafe-type-assertion -- narrowing `object` for entry iteration
      )) {
        if (k in s && typeof v === typeof (s as Record<string, unknown>)[k]) {
          (s as Record<string, unknown>)[k] = v;
        }
      }
    }
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
