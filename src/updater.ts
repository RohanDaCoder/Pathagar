/* updater.ts — in-app update check against GitHub Releases (tag-based).
   Android only: the banner links the signed APK asset. On the web the
   service worker hot-updates the shell on the next visit — there is nothing
   to check, so checkForUpdate() returns null immediately. */
import { APP_VERSION, NATIVE, REPO } from "./config";
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
export type { UpdateInfo };
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!NATIVE) return null; // web auto-updates — no update UI there
  if (!navigator.onLine) return null;
  try {
    const r = await fetch(RELEASES_API, {
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!r.ok) return null;
    const rel: GhRelease = await r.json();
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
