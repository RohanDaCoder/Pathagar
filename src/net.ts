/* net.ts — network adapter (PWA-only)
   API host  : CORS open (Access-Control-Allow-Origin: *) -> fetch directly
   PDF host  : NO CORS headers -> fetch via same-origin reverse proxy
               (Netlify /pdf/* -> pdf.tetashweb.xyz/*)
   Progress  : Netlify's edge serves the proxied PDFs brotli-compressed, so
   content-length is the COMPRESSED size while the stream reader counts
   DECOMPRESSED bytes — got/total blew past 100% instantly (the "progress bar
   jumps 0->100" bug). A 1-byte Range probe (not compressed, verified) gives
   the true total, so progress is real even through the compressed proxy. */
import { API_KEY, API_URL, PDF_PROXY_PREFIX } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg?: string) {
    super(msg || `HTTP ${status}`);
    this.status = status;
  }
}

export function pdfFetchUrl(url: string): string {
  const p = PDF_PROXY_PREFIX.endsWith("/")
    ? PDF_PROXY_PREFIX
    : `${PDF_PROXY_PREFIX}/`;
  const m = url.match(/^https?:\/\/[^/]+\/(.*)$/);
  return m ? p + m[1] : url;
}

export async function apiGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(API_URL.replace(/\/?$/, "/") + path);
  url.searchParams.set("key", API_KEY);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  const r = await fetch(url.toString());
  if (!r.ok) throw new ApiError(r.status);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- API boundary: the caller owns the shape
  return (await r.json()) as T;
}

function concatU8(parts: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.byteLength;
  }
  return out;
}

export interface DownloadOpts {
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

/* one-byte ranged GET to learn the true (decompressed) total size */
async function probeTotal(url: string, signal?: AbortSignal): Promise<number> {
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-0" }, signal });
    const cr = r.headers.get("content-range");
    const m = cr?.match(/\/(\d+)\s*$/);
    return m ? Number.parseInt(m[1], 10) : 0;
  } catch {
    return 0;
  }
}

async function webDownload(
  url: string,
  onProgress: DownloadOpts["onProgress"],
  signal?: AbortSignal,
): Promise<Uint8Array> {
  /* the probe and the body fetch run concurrently: the probe only needs to
     win the race before the first progress paint matters (it normally does —
     the full body takes far longer than 1 byte) */
  const totalPromise = probeTotal(url, signal);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ApiError(res.status);
  const hdrTotal = Number.parseInt(
    res.headers.get("content-length") || "0",
    10,
  );
  const encoded = Boolean(res.headers.get("content-encoding"));
  /* if the transfer is compressed, content-length is the compressed size and
     must not be used for progress — wait for the probe instead */
  let total = encoded ? 0 : hdrTotal;

  if (!res.body?.getReader) {
    const buf = await res.arrayBuffer();
    onProgress?.(buf.byteLength, buf.byteLength);
    return new Uint8Array(buf);
  }
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop -- a stream must be read sequentially
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.byteLength;
    if (!total) {
      // eslint-disable-next-line no-await-in-loop -- one-time size probe lands before the first paint matters
      total = await totalPromise;
    }
    onProgress?.(got, total);
  }
  return concatU8(parts, got);
}

export function downloadPdf(
  url: string,
  { onProgress, signal }: DownloadOpts = {},
): Promise<Uint8Array> {
  return webDownload(url, onProgress, signal);
}
