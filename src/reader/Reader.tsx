/* reader/Reader.tsx — pdf.js viewer, renders downloaded PDFs from IndexedDB.
   pdf.js (npm pdfjs-dist@6) is dynamically imported so it lands in a lazy
   chunk with its own worker URL.

   Scaling: pages fit themselves to the viewport (fit-width by default,
   fit-page optional) and re-fit on resize/rotation. Zoom is real (pdf.js
   re-render), driven by buttons, +/- keys, ctrl+wheel and pinch. The pinch
   gesture is an isolated surface: it only resizes the canvas (the page
   itself cannot zoom), the surrounding chrome never moves, and the crisp
   re-render lands once on release. The canvas is `shrink-0 max-w-none` —
   a plain flex item gets visually squashed when it is wider than its
   container, which is what made pages look distorted on desktop before. */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ChevronLeft,
  ExternalLink,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorDialog } from "@/components/ErrorDialog";
import { toast } from "sonner";
import { DB } from "@/db";
import { errMessage } from "@/lib/errors";
import { parseBookName, stripLeadNum } from "@/lib/titles";
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
  return pdfjs;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
const PAD = 16;

export function Reader() {
  const { chapterId = "" } = useParams();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingRef = useRef<PDFDocumentLoadingTask | null>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const pageDimsRef = useRef<{ w: number; h: number } | null>(null);

  const [meta, setMeta] = useState<ChapterMeta | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [editingPage, setEditingPage] = useState(false);
  const [pageDraft, setPageDraft] = useState("");
  const [loading, setLoading] = useState(true);
  /* zoom = 0 → auto-fit; > 0 → manual absolute scale */
  const [zoom, setZoom] = useState(0);
  const [fitMode, setFitMode] = useState<"width" | "page">("width");
  const [zoomPct, setZoomPct] = useState(0); // displayed % of current render
  const lastPageRef = useRef(0); // detects page turns (scroll reset) vs zooms
  type FitMode = "width" | "page";
  const stateRef = useRef<{
    pageNum: number;
    zoom: number;
    fitMode: FitMode;
  }>({ pageNum: 1, zoom: 0, fitMode: "width" });

  useEffect(() => {
    stateRef.current = { pageNum, zoom, fitMode };
  }, [pageNum, zoom, fitMode]);

  const fitScale = useCallback((): number => {
    const wrap = wrapRef.current;
    const dims = pageDimsRef.current;
    if (!wrap || !dims) return 1;
    const fitW = Math.max(MIN_ZOOM, (wrap.clientWidth - PAD) / dims.w);
    if (stateRef.current.fitMode === "page")
      return Math.max(
        MIN_ZOOM,
        Math.min(fitW, (wrap.clientHeight - PAD) / dims.h),
      );
    return fitW;
  }, []);

  const renderPage = useCallback(async (page: number, scale: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !scale) return;
    const pg = await doc.getPage(page);
    pageDimsRef.current = {
      w: pg.getViewport({ scale: 1 }).width,
      h: pg.getViewport({ scale: 1 }).height,
    };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const eff = clampZoom(scale);
    const vp = pg.getViewport({ scale: eff * dpr });
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
    canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
    taskRef.current?.cancel();
    taskRef.current = pg.render({ canvas, viewport: vp });
    setNumPages(doc.numPages);
    setZoomPct(Math.round(eff * 100));
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
        pageDimsRef.current = null;
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
        setZoom(0);
        lastPageRef.current = 0; // new doc → the render effect scrolls to top
        stateRef.current = {
          pageNum: 1,
          zoom: 0,
          fitMode: stateRef.current.fitMode,
        };
        await renderPage(1, fitScale());
      } catch (e) {
        if (!cancelled) setOpenError(errMessage(e));
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
  }, [chapterId, navigate, renderPage, fitScale]);

  // re-render on page / zoom / fit change
  useEffect(() => {
    if (!docRef.current || loading) return;
    const eff = zoom || fitScale();
    void renderPage(pageNum, eff);
    /* scroll resets on page turns only — a zoom change (button, key or
       pinch release) must keep the reader's position */
    if (lastPageRef.current !== pageNum) {
      lastPageRef.current = pageNum;
      wrapRef.current?.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-effect-dependencies -- fitScale/renderPage are stable; refitting on identity change would loop renders
  }, [pageNum, zoom, fitMode, loading, fitScale, renderPage]);

  // re-fit when the viewport changes (resize / rotate / devtools)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return undefined;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      if (stateRef.current.zoom) return; // manual zoom stays
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (docRef.current && !loading)
          void renderPage(stateRef.current.pageNum, fitScale());
      }, 120);
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, [loading, fitScale, renderPage]);

  const zoomBy = useCallback(
    (factor: number) => {
      const cur = stateRef.current.zoom || fitScale();
      setZoom(clampZoom(cur * factor));
    },
    [fitScale],
  );

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown")
        setPageNum((p) => Math.min(p + 1, numPages));
      else if (e.key === "ArrowLeft" || e.key === "PageUp")
        setPageNum((p) => Math.max(p - 1, 1));
      else if (e.key === "Escape") void navigate(-1);
      else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(1 / 1.25);
      else if (e.key === "0") {
        setZoom(0);
        setFitMode("width");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages, navigate, zoomBy]);

  // ctrl/cmd+wheel zoom (plain wheel scrolls the page)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.002));
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [zoomBy]);

  // touch: the PDF area is its own pan/zoom surface. One finger pans (or
  // swipes pages at fit zoom); two fingers pinch-zoom the canvas in place —
  // the page itself can no longer zoom (user-scalable=no + no pinch-zoom
  // token in touch-action), so the header/footer chrome stays put while
  // only the PDF moves. During the gesture the canvas is only CSS-resized
  // (smooth 60fps); the crisp pdf.js re-render happens once, on release.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return undefined;
    const pointers = new Map<number, { x: number; y: number }>();
    let swipeStart: { x: number; y: number } | null = null;
    let pinchStartDist = 0;
    let pinchBaseZoom = 0; // absolute scale when the gesture began
    let pinchRatio = 1;
    let baseW = 0;
    let baseH = 0;
    let anchor: { x: number; y: number } | null = null; // canvas coords

    const dist = () => {
      const [a, b] = [...pointers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const midpoint = () => {
      const [a, b] = [...pointers.values()];
      return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    };

    const applyPinch = () => {
      const canvas = canvasRef.current;
      if (!canvas || !anchor) return;
      const ratio = dist() / pinchStartDist;
      const z = clampZoom(pinchBaseZoom * ratio);
      pinchRatio = z / pinchBaseZoom;
      canvas.style.width = `${Math.round(baseW * pinchRatio)}px`;
      canvas.style.height = `${Math.round(baseH * pinchRatio)}px`;
      /* keep the grabbed PDF point under the fingers */
      const rect = canvas.getBoundingClientRect();
      const mid = midpoint();
      wrap.scrollLeft += rect.left + anchor.x * pinchRatio - mid.x;
      wrap.scrollTop += rect.top + anchor.y * pinchRatio - mid.y;
      setZoomPct(Math.round(z * 100));
    };

    const commitPinch = () => {
      pinchStartDist = 0;
      anchor = null;
      const z = clampZoom(pinchBaseZoom * pinchRatio);
      /* a no-op pinch must not lock in a manual zoom */
      if (Math.abs(z - (stateRef.current.zoom || fitScale())) > 0.001)
        setZoom(z); // re-renders at the same size — no visual jump
    };

    const onStart = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        swipeStart = { x: e.clientX, y: e.clientY };
      } else if (pointers.size === 2) {
        swipeStart = null;
        const canvas = canvasRef.current;
        if (!canvas) return;
        pinchStartDist = dist();
        pinchBaseZoom = stateRef.current.zoom || fitScale();
        pinchRatio = 1;
        baseW = canvas.offsetWidth;
        baseH = canvas.offsetHeight;
        const rect = canvas.getBoundingClientRect();
        const mid = midpoint();
        anchor = { x: mid.x - rect.left, y: mid.y - rect.top };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2 && pinchStartDist) applyPinch();
    };
    const onEnd = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pointers.size < 2 && pinchStartDist) commitPinch();
      if (swipeStart === null) return;
      /* page swipes only while at fit — a zoomed page must pan, not turn */
      if (stateRef.current.zoom === 0) {
        const dx = e.clientX - swipeStart.x;
        const dy = e.clientY - swipeStart.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
          if (dx < 0) setPageNum((p) => Math.min(p + 1, numPages));
          else setPageNum((p) => Math.max(p - 1, 1));
        }
      }
      swipeStart = null;
    };
    wrap.addEventListener("pointerdown", onStart);
    wrap.addEventListener("pointermove", onMove);
    wrap.addEventListener("pointerup", onEnd);
    wrap.addEventListener("pointercancel", onEnd);
    return () => {
      wrap.removeEventListener("pointerdown", onStart);
      wrap.removeEventListener("pointermove", onMove);
      wrap.removeEventListener("pointerup", onEnd);
      wrap.removeEventListener("pointercancel", onEnd);
    };
  }, [numPages, fitScale]);

  async function openInTab() {
    const blob = await DB.getFile(chapterId);
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    window.open(u, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  }

  /* tap the page counter → type a number → Enter/blur jumps */
  function commitPage() {
    setEditingPage(false);
    const n = parseInt(pageDraft, 10);
    if (Number.isFinite(n) && numPages > 0)
      setPageNum(Math.min(Math.max(n, 1), numPages));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <ErrorDialog
        open={openError !== null}
        onOpenChange={(o) => {
          if (!o) {
            setOpenError(null);
            void navigate(-1);
          }
        }}
        title="Could not open this PDF"
        message="The file may be damaged, or the app could not read it from storage. Try downloading the chapter again."
        detail={openError ?? undefined}
        actionLabel="Go back"
        onAction={() => void navigate(-1)}
      />
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
            {meta
              ? `${stripLeadNum(meta.title) || meta.title} · ${parseBookName(meta.bookName).name}`
              : "Reader"}
          </p>
        </div>
        <span
          className="min-w-11 text-center text-xs tabular-nums text-muted-foreground"
          aria-label={`Zoom ${zoomPct}%`}
        >
          {zoomPct}%
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom out"
          onClick={() => zoomBy(1 / 1.25)}
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.25)}
        >
          <Plus className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label={fitMode === "width" ? "Fit page" : "Fit width"}
          title="Toggle fit width / fit page"
          onClick={() => {
            setZoom(0);
            setFitMode((m) => (m === "width" ? "page" : "width"));
          }}
        >
          <Maximize2 className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Open in new tab"
          onClick={() => void openInTab()}
        >
          <ExternalLink className="size-4" aria-hidden="true" />
        </Button>
      </header>

      {/* no pinch-zoom token: the browser must never page-zoom from here —
          two-finger gestures belong to the pinch handler below */}
      <div
        ref={wrapRef}
        className="flex flex-1 justify-center overflow-auto bg-muted/30"
        style={{ touchAction: "pan-x pan-y" }}
      >
        {loading ? (
          <p className="pt-10 text-sm text-muted-foreground">Loading PDF…</p>
        ) : (
          /* shrink-0: a flex item wider than its container gets visually
             squashed (aspect broken) unless shrinking is disabled */
          <canvas
            ref={canvasRef}
            className="my-2 max-w-none shrink-0 shadow-lg"
          />
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
        <div className="flex flex-1 items-center justify-center">
          {editingPage ? (
            <input
              autoFocus
              type="text"
              inputMode="numeric"
              value={pageDraft}
              aria-label="Go to page"
              onChange={(e) =>
                setPageDraft(e.target.value.replace(/[^0-9]/g, ""))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") commitPage();
                if (e.key === "Escape") setEditingPage(false);
              }}
              onBlur={commitPage}
              className="w-20 rounded-md border bg-transparent px-2 py-1 text-center text-sm tabular-nums outline-none focus:border-primary"
            />
          ) : (
            <button
              type="button"
              className="text-sm tabular-nums text-muted-foreground hover:text-foreground"
              onClick={() => {
                setPageDraft(String(pageNum));
                setEditingPage(true);
              }}
              aria-label="Jump to page"
            >
              {pageNum} / {numPages}
            </button>
          )}
        </div>
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
