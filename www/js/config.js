/* config.js — platform detection, settings, shared app state */
import { Capacitor } from '../vendor/capacitor/capacitor-core.js';

export const NATIVE = Capacitor.isNativePlatform();
export const APP_NAME = 'Pathagar';
export const APP_VERSION = '1.0.1';
export const REPO = 'RohanDaCoder/Pathagar'; // releases feed the in-app updater

export const DEFAULT_SETTINGS = {
  apiUrl: 'https://books.tetashweb.xyz/api/v1/app/',
  apiKey: 'qbznP4XjGALmagvQOOlN5zVZmcovJfHPE1a3xHmPnV2B9eQz52yC3wm7nVbqqyG3',
  proxyPrefix: '/pdf/',          // web: same-origin Netlify proxy path
  useProxyOnWeb: !NATIVE,        // native downloads directly (no CORS in native http)
  theme: 'auto',
  concurrency: 2,
};

/* global mutable app state (single source of truth) */
export const S = {
  settings: { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('ptg:settings') || '{}') },
  snapshot: null,                // bundled offline catalog
  route: { name: 'home', args: [] },
  dl: new Map(),                 // chapterId -> {status,pct,loaded,total,error,abort}
  autoOpen: new Set(),           // chapter ids to open when download finishes
  bookCtx: new Map(),            // bookId -> {name, branchId}
};

export function saveSettings() { localStorage.setItem('ptg:settings', JSON.stringify(S.settings)); }
export function applyTheme() { document.documentElement.dataset.theme = S.settings.theme; }
