/* utils.ts — DOM helpers, number formatting, toasts, shared SVG icons */

export const $ = <T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T | null => root.querySelector<T>(sel);
export const $$ = <T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T[] => [...root.querySelectorAll<T>(sel)];

/* the app shell guarantees these elements exist — throw a clear error if not,
   instead of scattering non-null assertions through the views */
export function requireEl<T extends HTMLElement = HTMLElement>(
  sel: string,
  root: ParentNode = document,
): T {
  const el = root.querySelector<T>(sel);
  if (!el) throw new Error(`Missing required element: ${sel}`);
  return el;
}

/* kept the historical name `bn` (it used to render Bengali digits); the UI is
   English now, so it passes values through unchanged */
export const bn = (n: string | number): string => String(n);
export const fmtMB = (bytes: number): string =>
  `${bn((bytes / 1048576).toFixed(1))} MB`;
export const esc = (s: unknown): string =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );

export function toast(msg: string, kind = "") {
  const t = document.createElement("div");
  t.className = `toast ${kind}`;
  t.textContent = msg;
  const host = $("#toasts");
  if (!host) return;
  host.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transition = "opacity .3s";
  }, 3400);
  setTimeout(() => t.remove(), 3800);
}

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

/* ---------- shared SVG icons ---------- */
export const svgDownload =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11"/><path d="m6.5 10.5 5.5 5 5.5-5"/><path d="M5 20h14"/></svg>';
export const svgCheck =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>';
export const svgPlay =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>';
export const svgRetry =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.34 6.34"/><path d="M20 5v6h-6"/></svg>';
export const svgPdf =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h4"/></svg>';
export const svgChev =
  '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>';
export const svgWarn =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 9.5V14"/><path d="M12 17.2v.3"/></svg>';
export const svgOffline =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l20 20"/><path d="M8.5 16.5a4.5 4.5 0 0 1 7 0"/><path d="M5 12.9a9.5 9.5 0 0 1 3.7-2.4M15.4 10.4a9.5 9.5 0 0 1 3.6 2.5"/><path d="M1.5 9.5A14 14 0 0 1 7 6M16.8 6a14 14 0 0 1 5.7 3.5"/><circle cx="12" cy="19.5" r=".5" fill="currentColor"/></svg>';
export const svgTrash =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2"/><path d="M6.5 7l1 13h9l1-13"/></svg>';
export const svgBookIco =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5"/><path d="M19 17H6.5a2.5 2.5 0 0 0 0 5H19"/></svg>';
export const svgMosque =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2s3 2.2 3 5c0 1.4-.8 2.4-1.5 3h-3C9.8 9.4 9 8.4 9 7c0-2.8 3-5 3-5z"/><path d="M4 20v-6c0-1.6 1.2-3 3-3h10c1.8 0 3 1.4 3 3v6"/><path d="M2 20h20"/><path d="M10 20v-4a2 2 0 0 1 4 0v4"/></svg>';
export const svgGlobe =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19"/><path d="M12 2.5c2.7 2.6 4 5.9 4 9.5s-1.3 6.9-4 9.5c-2.7-2.6-4-5.9-4-9.5s1.3-6.9 4-9.5z"/></svg>';
export const svgHistory =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 3.5V6a2 2 0 0 0 2 2H8"/><path d="M12 7.5V12l3 2"/></svg>';
export const svgLibrary =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5z"/><path d="m9 20 1.5-3.5L12 13l3 6-3 1z" stroke-linejoin="round"/></svg>';
export const svgUpdate =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>';

export const BRANCH_ICONS: Record<number, string> = {
  18203: svgBookIco,
  17786: svgMosque,
  17794: svgGlobe,
  101: svgHistory,
};
export const BRANCH_BG: Record<number, string> = {
  18203: "bg-1",
  17786: "bg-2",
  17794: "bg-3",
  101: "bg-4",
};

/* ---------- shared view fragments ---------- */
export function viewHead(title: string, sub: string, brand = false): string {
  return `<div class="page-head">${
    brand
      ? `
    <div class="brandmark"><div class="logo">P</div><div>
      <h1>${esc(title)}</h1><div class="sub">${esc(sub)}</div>
    </div></div>`
      : `
    <h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}`
  }
  </div>`;
}
export function crumbs(branch: string): string {
  return `<div class="crumbs"><a href="#/home">Home</a> ${svgChev} <span>${esc(branch)}</span></div>`;
}
