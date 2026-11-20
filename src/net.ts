/* net.ts — network adapter
   API host  : CORS open (Access-Control-Allow-Origin: *) -> fetch directly
   PDF host  : NO CORS headers ->
     - web    : fetch via same-origin reverse proxy (Netlify /pdf/* -> pdf.tetashweb.xyz/*)
     - native : CapacitorHttp (native Java http, no CORS), 1 MiB ranged chunks for progress */
import { CapacitorHttp } from "@capacitor/core";
import { NATIVE, S } from "./config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg?: string) {
    super(msg || `HTTP ${status}`);
    this.status = status;
  }
}

export function pdfFetchUrl(url: string): string {
  if (NATIVE || !S.settings.useProxyOnWeb) return url;
  const p = S.settings.proxyPrefix || "/pdf/";
  const m = url.match(/^https?:\/\/[^/]+\/(.*)$/);
  return m ? (p.endsWith("/") ? p : `${p}/`) + m[1] : url;
}

export async function apiGet<T>(
  path: string,
  params: Record<string, string | number> = {},
): Promise<T> {
  const url = new URL(S.settings.apiUrl.replace(/\/?$/, "/") + path);
  url.searchParams.set("key", S.settings.apiKey);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  if (NATIVE) {
    const r = await CapacitorHttp.get({
      url: url.toString(),
      responseType: "json",
    });
    if (r.status >= 400) throw new ApiError(r.status);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- API boundary: the caller owns the shape
    return r.data as T;
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new ApiError(r.status);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- API boundary: the caller owns the shape
  return (await r.json()) as T;
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

function toU8(data: unknown): Uint8Array | null {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return typeof data === "string" ? b64ToU8(data) : null;
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

/* native: 1 MiB ranged chunks through CapacitorHttp -> real progress */
async function nativeDownload(
  url: string,
  onProgress: DownloadOpts["onProgress"],
  isCancelled: () => boolean | undefined,
): Promise<Uint8Array> {
  const CHUNK = 1 << 20;
  let total = 0;
  /* GET 1 byte (not HEAD — HEAD ignores Range) to learn the total size */
  const probe = await CapacitorHttp.request({
    method: "GET",
    url,
    headers: { Range: "bytes=0-0" },
    responseType: "arraybuffer",
  }).catch(() => null);
  const hdrs = (probe?.headers ?? {}) as Record<string, string>;
  const crHeader =
    hdrs["content-range"] || hdrs["Content-Range"] || hdrs["CONTENT-RANGE"];
  const m = crHeader?.match(/\/(\d+)\s*$/);
  if (m) total = Number.parseInt(m[1], 10);

  const parts: Uint8Array[] = [];
  let got = 0;
  if (total > 0) {
    for (let start = 0; start < total; start += CHUNK) {
      if (isCancelled()) throw new DOMException("aborted", "AbortError");
      const end = Math.min(start + CHUNK, total) - 1;
      // eslint-disable-next-line no-await-in-loop -- ranged chunks must arrive in order
      const r = await CapacitorHttp.request({
        method: "GET",
        url,
        headers: { Range: `bytes=${start}-${end}` },
        responseType: "arraybuffer",
      });
      if (r.status >= 400) throw new ApiError(r.status);
      const u8 = toU8(r.data);
      if (!u8) throw new Error("Unexpected data format");
      parts.push(u8);
      got += u8.byteLength;
      onProgress?.(got, total);
    }
    return concatU8(parts, got);
  }
  /* no range support -> single request, no granular progress */
  const r = await CapacitorHttp.request({
    method: "GET",
    url,
    responseType: "arraybuffer",
  });
  if (r.status >= 400) throw new ApiError(r.status);
  const u8 = toU8(r.data);
  if (!u8) throw new Error("Unexpected data format");
  onProgress?.(u8.byteLength, u8.byteLength);
  return u8;
}

/* web: streaming fetch with progress; falls back to arrayBuffer */
async function webDownload(
  url: string,
  onProgress: DownloadOpts["onProgress"],
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ApiError(res.status);
  const total = Number.parseInt(res.headers.get("content-length") || "0", 10);
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
    onProgress?.(got, total || got);
  }
  return concatU8(parts, got);
}

export function downloadPdf(
  url: string,
  { onProgress, signal }: DownloadOpts = {},
): Promise<Uint8Array> {
  const isCancelled = () => signal?.aborted;
  return NATIVE
    ? nativeDownload(url, onProgress, isCancelled)
    : webDownload(url, onProgress, signal);
}
