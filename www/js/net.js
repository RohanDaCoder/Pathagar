/* net.js — network adapter
   API host  : CORS open (Access-Control-Allow-Origin: *) -> fetch directly
   PDF host  : NO CORS headers ->
     - web    : fetch via same-origin reverse proxy (Netlify /pdf/* -> pdf.tetashweb.xyz/*)
     - native : CapacitorHttp (native Java http, no CORS), 1 MiB ranged chunks for progress */
import { CapacitorHttp } from '../vendor/capacitor/capacitor-core.js';
import { NATIVE, S } from './config.js';

export class ApiError extends Error {
  constructor(status, msg) { super(msg || `HTTP ${status}`); this.status = status; }
}

export function pdfFetchUrl(url) {
  if (NATIVE || !S.settings.useProxyOnWeb) return url;
  const p = S.settings.proxyPrefix || '/pdf/';
  const m = url.match(/^https?:\/\/[^/]+\/(.*)$/);
  return m ? (p.endsWith('/') ? p : p + '/') + m[1] : url;
}

export async function apiGet(path, params = {}) {
  const url = new URL(S.settings.apiUrl.replace(/\/?$/, '/') + path);
  url.searchParams.set('key', S.settings.apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  if (NATIVE) {
    const r = await CapacitorHttp.get({ url: url.toString(), responseType: 'json' });
    if (r.status >= 400) throw new ApiError(r.status);
    return r.data;
  }
  const r = await fetch(url.toString());
  if (!r.ok) throw new ApiError(r.status);
  return r.json();
}

function b64ToU8(b64) {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
const toU8 = (data) =>
  data instanceof Uint8Array ? data :
  data instanceof ArrayBuffer ? new Uint8Array(data) :
  (typeof data === 'string' ? b64ToU8(data) : null);

function concatU8(parts, total) {
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.byteLength; }
  return out;
}

/* native: 1 MiB ranged chunks through CapacitorHttp -> real progress */
async function nativeDownload(url, onProgress, isCancelled) {
  const CHUNK = 1 << 20;
  let total = 0;
  /* GET 1 byte (not HEAD — HEAD ignores Range) to learn the total size */
  const probe = await CapacitorHttp.request({
    method: 'GET', url, headers: { Range: 'bytes=0-0' }, responseType: 'arraybuffer',
  }).catch(() => null);
  const hdrs = probe?.headers || {};
  const crHeader = hdrs['content-range'] || hdrs['Content-Range'] || hdrs['CONTENT-RANGE'];
  if (crHeader && /\/(\d+)\s*$/.test(crHeader)) total = parseInt(crHeader.match(/\/(\d+)\s*$/)[1], 10);

  const parts = [];
  let got = 0;
  if (total > 0) {
    for (let start = 0; start < total; start += CHUNK) {
      if (isCancelled()) throw new DOMException('aborted', 'AbortError');
      const end = Math.min(start + CHUNK, total) - 1;
      const r = await CapacitorHttp.request({
        method: 'GET', url, headers: { Range: `bytes=${start}-${end}` }, responseType: 'arraybuffer',
      });
      if (r.status >= 400) throw new ApiError(r.status);
      const u8 = toU8(r.data);
      if (!u8) throw new Error('Unexpected data format');
      parts.push(u8); got += u8.byteLength;
      onProgress(got, total);
    }
    return concatU8(parts, got);
  }
  /* no range support -> single request, no granular progress */
  const r = await CapacitorHttp.request({ method: 'GET', url, responseType: 'arraybuffer' });
  if (r.status >= 400) throw new ApiError(r.status);
  const u8 = toU8(r.data);
  if (!u8) throw new Error('Unexpected data format');
  onProgress(u8.byteLength, u8.byteLength);
  return u8;
}

/* web: streaming fetch with progress; falls back to arrayBuffer */
async function webDownload(url, onProgress, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new ApiError(res.status);
  const total = parseInt(res.headers.get('content-length') || '0', 10);
  if (!res.body?.getReader) {
    const buf = await res.arrayBuffer();
    onProgress(buf.byteLength, buf.byteLength);
    return new Uint8Array(buf);
  }
  const reader = res.body.getReader();
  const parts = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value); got += value.byteLength;
    onProgress(got, total || got);
  }
  return concatU8(parts, got);
}

export function downloadPdf(url, { onProgress = () => {}, signal } = {}) {
  const isCancelled = () => signal?.aborted;
  return NATIVE ? nativeDownload(url, onProgress, isCancelled)
                : webDownload(url, onProgress, signal);
}
