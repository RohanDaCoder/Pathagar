/* updater.ts — in-app update check against GitHub Releases (tag-based)
   Android: banner links the signed APK asset (browser download → install).
   Web (PWA): the service worker already hot-updates the shell; the banner
   simply points at the release page. */
import { APP_VERSION, REPO } from "./config";
import type { UpdateInfo } from "./types";

const RELEASES_API = `https://api.github.com/repos/${REPO}/releases/latest`;

export function parseSemver(
  v: string | number | null | undefined,
): [number, number, number] | null {
  const m = String(v || "")
    .trim()
    .replace(/^v/i, "")
    .match(/^(\d+)\.(\d+)\.(\d+)/);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function isNewer(current: string, candidate: string): boolean {
  const a = parseSemver(current);
  const b = parseSemver(candidate);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) {
    if (b[i] !== a[i]) return b[i] > a[i];
  }
  return false;
}

interface GhRelease {
  tag_name?: string;
  html_url?: string;
  body?: string;
  assets?: { name?: string; browser_download_url?: string }[];
}

/* returns UpdateInfo | null (null = up to date, skipped, offline or API error) */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!navigator.onLine) return null;
  try {
    const r = await fetch(RELEASES_API, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return null;
    const rel = (await r.json()) as GhRelease;
    const latest = (rel.tag_name || "").replace(/^v/, "");
    if (!isNewer(APP_VERSION, latest)) return null;
    const apk = (rel.assets || []).find((a) => /\.apk$/i.test(a.name || ""));
    return {
      current: APP_VERSION,
      latest,
      apkUrl:
        apk?.browser_download_url ||
        rel.html_url ||
        `https://github.com/${REPO}/releases`,
      htmlUrl: rel.html_url || `https://github.com/${REPO}/releases`,
      notes: rel.body || "",
      skipped: localStorage.getItem("ptg:skipVer") === latest,
    };
  } catch {
    return null;
  }
}

export function skipVersion(v: string) {
  localStorage.setItem("ptg:skipVer", v);
}
