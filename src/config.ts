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
  useProxyOnWeb: boolean; // native downloads directly (no CORS in native http)
  theme: string;
  concurrency: number;
}

export const DEFAULT_SETTINGS: Settings = {
  apiUrl: "https://books.tetashweb.xyz/api/v1/app/",
  apiKey: "qbznP4XjGALmagvQOOlN5zVZmcovJfHPE1a3xHmPnV2B9eQz52yC3wm7nVbqqyG3",
  proxyPrefix: "/pdf/",
  useProxyOnWeb: !NATIVE,
  theme: "auto",
  concurrency: 2,
};

/* localStorage is absent under `bun test` — guard so the module imports cleanly */
const stored =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("ptg:settings")
    : null;

/* global mutable app state (single source of truth) */
export const S = {
  settings: {
    ...DEFAULT_SETTINGS,
    ...(JSON.parse(stored || "{}") as Partial<Settings>),
  },
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
export function applyTheme() {
  document.documentElement.dataset.theme = S.settings.theme;
}
