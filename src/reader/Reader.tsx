/* reader/Reader.tsx — pdf.js viewer, renders downloaded PDFs from IndexedDB.
   pdf.js (npm pdfjs-dist@6) is dynamically imported so it lands in a lazy
   chunk with its own worker URL. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, ExternalLink, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { NATIVE } from "@/config";
import { DB } from "@/db";
import { errMessage } from "@/lib/errors";
import type { ChapterMeta } from "@/types";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from "pdfjs-dist";

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjs: PdfjsLib | null = null;

async function ensurePdfJs(): Promise<PdfjsLib> {
  if (pdfjs) return pdfjs;
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  pdfjs = lib;
  return lib;
}

export function Reader() {
  const { chapterId = "" } = useParams();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingRef = useRef<PDFDocumentLoadingTask | null>(null);
  const taskRef = useRef<RenderTask | null>(null);

  const [meta, setMeta] = useState<ChapterMeta | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scale, setScale] = useState(0);
  const fitRef = useRef(0);
  const stateRef = useRef({ pageNum: 1, scale: 0 });

  useEffect(() => {
    stateRef.current = { pageNum, scale };
  }, [pageNum, scale]);

  const renderPage = useCallback(async (page: number, renderScale?: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!doc || !canvas || !wrap) return;
    const pg = await doc.getPage(page);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (!renderScale || !fitRef.current) {
      // fit is computed only when the canvas is in the layout — measuring
      // before mount returns a stale (too narrow) wrap width
      const v1 = pg.getViewport({ scale: 1 });
      fitRef.current = Math.max(0.2, (wrap.clientWidth - 16) / v1.width);
    }
    const eff = Math.min(4, Math.max(0.25, renderScale ?? fitRef.current));
    const vp = pg.getViewport({ scale: eff * dpr });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
    taskRef.current?.cancel();
    taskRef.current = pg.render({ canvas, viewport: vp });
    setNumPages(doc.numPages);
    try {
      await taskRef.current.promise;
    } catch {
      /* cancelled renders are fine */
    }
  }, []);

  // load document
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let m: ChapterMeta | undefined;
      let blob: Blob | undefined;
      try {
        m = await DB.getMeta(chapterId);
        blob = await DB.getFile(chapterId);
        if (cancelled) return;
        setLoading(true); // after the first await — no synchronous setState in the effect
        fitRef.current = 0;
      } catch {
        /* handled below */
      }
      if (cancelled) return;
      if (!m || !blob) {
        toast.error("File not found — download it first");
        void navigate("/", { replace: true });
        return;
      }
      localStorage.setItem("ptg:lastRead", chapterId);
      void DB.updateMeta(chapterId, { lastOpened: Date.now() });
      setMeta(m);
      try {
        const lib = await ensurePdfJs();
        const data = new Uint8Array(await blob.arrayBuffer());
        const task = lib.getDocument({ data });
        loadingRef.current = task;
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          return;
        }
        docRef.current = doc;
        setPageNum(1);
        setScale(0);
        stateRef.current = { pageNum: 1, scale: 0 };
        await renderPage(1);
      } catch (e) {
        if (!cancelled) {
          toast.error(`Could not open PDF: ${errMessage(e)}`);
          void navigate(-1);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      taskRef.current?.cancel();
      void loadingRef.current?.destroy();
      loadingRef.current = null;
      docRef.current = null;
    };
  }, [chapterId, navigate, renderPage]);

  // re-render on page/scale change
  useEffect(() => {
    if (!docRef.current || loading) return;
    void renderPage(pageNum, scale || undefined); // scale 0 = fit to width
    wrapRef.current?.scrollTo({ top: 0 });
  }, [pageNum, scale, renderPage, loading]);

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown")
        setPageNum((p) => Math.min(p + 1, numPages));
      else if (e.key === "ArrowLeft" || e.key === "PageUp")
        setPageNum((p) => Math.max(p - 1, 1));
      else if (e.key === "Escape") void navigate(-1);
      else if (e.key === "+")
        setScale((s) => Math.min(4, (s || fitRef.current) * 1.25));
      else if (e.key === "-")
        setScale((s) => Math.max(0.25, (s || fitRef.current) / 1.25));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages, navigate]);

  // swipe navigation
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    let x: number | null = null;
    let y = 0;
    const onStart = (e: TouchEvent) => {
      x = e.touches[0].clientX;
      y = e.touches[0].clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (x === null) return;
      const dx = e.changedTouches[0].clientX - x;
      const dy = e.changedTouches[0].clientY - y;
      x = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0) setPageNum((p) => Math.min(p + 1, numPages));
        else setPageNum((p) => Math.max(p - 1, 1));
      }
    };
    wrap.addEventListener("touchstart", onStart, { passive: true });
    wrap.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      wrap.removeEventListener("touchstart", onStart);
      wrap.removeEventListener("touchend", onEnd);
    };
  }, [numPages]);

  async function openInTab() {
    const blob = await DB.getFile(chapterId);
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    window.open(u, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-1 border-b bg-background px-2 py-1.5">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Close reader"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {meta ? `${meta.title} · ${meta.bookName}` : "Reader"}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom out"
          onClick={() =>
            setScale((s) => Math.max(0.25, (s || fitRef.current) / 1.25))
          }
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom in"
          onClick={() =>
            setScale((s) => Math.min(4, (s || fitRef.current) * 1.25))
          }
        >
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        {!NATIVE ? (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Open in new tab"
            onClick={() => void openInTab()}
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </header>

      <div
        ref={wrapRef}
        className="flex flex-1 justify-center overflow-auto bg-muted/30"
      >
        {loading ? (
          <p className="pt-10 text-sm text-muted-foreground">Loading PDF…</p>
        ) : (
          <canvas ref={canvasRef} className="my-2 shadow-lg" />
        )}
      </div>

      <footer className="flex items-center gap-2 border-t bg-background px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <Button
          variant="outline"
          size="sm"
          disabled={pageNum <= 1}
          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
        >
          ‹ Prev
        </Button>
        <p className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
          {pageNum} / {numPages}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={numPages > 0 && pageNum >= numPages}
          onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
        >
          Next ›
        </Button>
      </footer>
    </div>
  );
}
