/* serve.ts — tiny static server for dist/ with the /pdf/* reverse proxy.
   Bun replacement for the old Python dev proxy (dev mode now lives in vite,
   this serves the production build locally):
     bun run serve            # http://127.0.0.1:4173 (dist + /pdf proxy + SPA fallback)
     PORT=8080 bun run serve  */
import { join } from "node:path";

const DIST = join(import.meta.dir, "..", "dist");
const PDF_UPSTREAM = "https://pdf.tetashweb.xyz/";
const PORT = Number(process.env.PORT ?? 4173);

async function proxyPdf(req: Request, pathname: string): Promise<Response> {
  const upstream = new URL(
    PDF_UPSTREAM + pathname.slice("/pdf/".length) + new URL(req.url).search,
  );
  const headers = new Headers();
  const range = req.headers.get("range");
  if (range) headers.set("range", range);
  const resp = await fetch(upstream, {
    method: req.method,
    headers,
    redirect: "follow",
  });
  const outHeaders = new Headers();
  for (const h of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "etag",
  ]) {
    const v = resp.headers.get(h);
    if (v) outHeaders.set(h, v);
  }
  return new Response(resp.body, { status: resp.status, headers: outHeaders });
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const { pathname } = new URL(req.url);

    if (pathname.startsWith("/pdf/")) {
      try {
        return await proxyPdf(req, pathname);
      } catch {
        return new Response("upstream unreachable", { status: 502 });
      }
    }

    /* static files from dist/, then SPA fallback (the app is hash-routed) */
    const file = Bun.file(join(DIST, pathname));
    if (await file.exists()) return new Response(file);

    const shell = Bun.file(join(DIST, "index.html"));
    if (await shell.exists()) return new Response(shell);
    return new Response("dist/ not built — run `bun run build` first", {
      status: 404,
    });
  },
});

console.log(
  `serving ${DIST} at http://127.0.0.1:${server.port}  (/pdf/* -> pdf.tetashweb.xyz)`,
);
