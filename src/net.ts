/* net.ts — network adapter. The API host is CORS-open (direct fetch); the
   PDF host sends no CORS headers, so PDFs go through the same-origin /pdf/*
   reverse proxy. */

import { API_KEY, API_URL, PDF_PROXY_PREFIX } from "./config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    msg?: string,
  ) {
    super(msg || `HTTP ${status}`);
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  async get<T>(
    path: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl.replace(/\/?$/, "/") + path);
    url.searchParams.set("key", this.apiKey);
    for (const [k, v] of Object.entries(params))
      url.searchParams.set(k, String(v));
    const r = await fetch(url.toString());
    if (!r.ok) throw new ApiError(r.status);
    // API boundary: the caller owns the response shape
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    return (await r.json()) as T;
  }
}

export const api = new ApiClient(API_URL, API_KEY);

export function pdfFetchUrl(url: string): string {
  const p = PDF_PROXY_PREFIX.endsWith("/")
    ? PDF_PROXY_PREFIX
    : `${PDF_PROXY_PREFIX}/`;
  const m = url.match(/^https?:\/\/[^/]+\/(.*)$/);
  return m ? p + m[1] : url;
}

export interface DownloadOpts {
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
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

/** One-byte ranged GET to learn the true (decompressed) total size — the
    proxy edge serves PDFs brotli-compressed, so content-length lies. */
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
  const totalPromise = probeTotal(url, signal);
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ApiError(res.status);
  const hdrTotal = Number.parseInt(
    res.headers.get("content-length") || "0",
    10,
  );
  const encoded = Boolean(res.headers.get("content-encoding"));
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
    // a stream must be read sequentially
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.byteLength;
    if (!total) {
      // the probe wins the race before the first progress paint matters
      // eslint-disable-next-line no-await-in-loop
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
