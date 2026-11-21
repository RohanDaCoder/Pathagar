/* reader/Reader.tsx — PDF viewer layout and state. Zoom is real (pdf.js
   re-render via PdfEngine), driven by buttons, +/- keys, ctrl+wheel and the
   pinch surface. Pages auto-fit the viewport (fit-width by default) and
   re-fit on resize/rotation. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { clampZoom, MAX_ZOOM, PdfEngine } from "./pdfEngine";
import { usePinchSurface } from "./usePinchSurface";

const PAD = 16;
type FitMode = "width" | "page";

export function Reader() {
  const { chapterId = "" } = useParams();
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useMemo(() => new PdfEngine(), []);

  const [meta, setMeta] = useState<ChapterMeta | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [editingPage, setEditingPage] = useState(false);
  const [pageDraft, setPageDraft] = useState("");
  const [loading, setLoading] = useState(true);
  /* zoom = 0 → auto-fit; > 0 → manual absolute scale */
  const [zoom, setZoom] = useState(0);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [zoomPct, setZoomPct] = useState(0); // displayed % of current render
  const [fitPct, setFitPct] = useState(0); // floor %: the current fit scale
  const lastPageRef = useRef(0); // detects page turns (scroll reset) vs zooms
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
    const dims = engine.dims;
    if (!wrap || !dims) return 1;
    const fitW = Math.max(0.25, (wrap.clientWidth - PAD) / dims.w);
    if (stateRef.current.fitMode === "page")
      return Math.max(0.25, Math.min(fitW, (wrap.clientHeight - PAD) / dims.h));
    return fitW;
  }, [engine]);

  const renderPage = useCallback(
    async (page: number, scale: number) => {
      await engine.render(page, scale);
      setNumPages(engine.numPages);
      setZoomPct(Math.round(clampZoom(scale) * 100));
      setFitPct(Math.round(fitScale() * 100)); // the zoom-out floor
    },
    [engine, fitScale],
  );

  const turnPage = useCallback(
    (dir: 1 | -1) => {
      setPageNum((p) =>
        dir > 0 ? Math.min(p + 1, numPages) : Math.max(p - 1, 1),
      );
    },
    [numPages],
  );

  usePinchSurface({
    wrapRef,
    canvasRef,
    fitScale,
    getZoom: () => stateRef.current.zoom,
    setZoom,
    setZoomPct,
    turnPage,
  });

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
        await engine.load(new Uint8Array(await blob.arrayBuffer()));
        if (cancelled) return;
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
      engine.destroy();
    };
  }, [chapterId, navigate, renderPage, fitScale, engine]);

  // re-render on page / zoom / fit change
  useEffect(() => {
    if (!numPages || loading) return; // numPages > 0 ⟺ a document rendered
    const eff = zoom || fitScale();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- renderPage awaits the engine render before any setState (async continuation)
    void renderPage(pageNum, eff);
    /* scroll resets on page turns only — a zoom change (button, key or
       pinch release) must keep the reader's position */
    if (lastPageRef.current !== pageNum) {
      lastPageRef.current = pageNum;
      wrapRef.current?.scrollTo({ top: 0 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-effect-dependencies -- fitScale/renderPage are stable; refitting on identity change would loop renders
  }, [pageNum, zoom, fitMode, loading, numPages, fitScale, renderPage]);

  // re-fit when the viewport changes (resize / rotate / devtools)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return undefined;
    let t: ReturnType<typeof setTimeout> | null = null;
    const ro = new ResizeObserver(() => {
      setFitPct(Math.round(fitScale() * 100)); // floor moves with the viewport
      if (stateRef.current.zoom) {
        /* rotation can shrink the viewport; a manual zoom that fell below
           the new fit floor returns to auto-fit (the floor is the invariant
           "never smaller than fits") */
        if (stateRef.current.zoom < fitScale()) setZoom(0);
        return; // other manual zooms stay
      }
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        if (engine.ready && !loading)
          void renderPage(stateRef.current.pageNum, fitScale());
      }, 120);
    });
    ro.observe(wrap);
    return () => {
      ro.disconnect();
      if (t) clearTimeout(t);
    };
  }, [loading, fitScale, renderPage, engine]);

  const zoomBy = useCallback(
    (factor: number) => {
      /* floor = the current fit scale: zooming out stops once the page
         fully fits the viewport — beyond that it would only shrink into
         gray gutters (the "pdf length" bound) */
      const cur = stateRef.current.zoom || fitScale();
      setZoom(clampZoom(cur * factor, fitScale()));
    },
    [fitScale],
  );

  // keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") turnPage(1);
      else if (e.key === "ArrowLeft" || e.key === "PageUp") turnPage(-1);
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
  }, [navigate, zoomBy, turnPage]);

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

  /* header affordance: zoom-out bottoms out at the fit floor (page fully
     fits), zoom-in at the absolute max — rounded-% compares with ±1
     tolerance; both values are state, set where the floor can move */
  const atMin = zoomPct <= fitPct + 1;
  const atMax = zoomPct >= MAX_ZOOM * 100 - 1;

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
          disabled={atMin}
          onClick={() => zoomBy(1 / 1.25)}
        >
          <Minus className="size-4" aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Zoom in"
          disabled={atMax}
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
          two-finger gestures belong to the pinch surface hook */}
      <div
        ref={wrapRef}
        className="flex flex-1 overflow-auto bg-muted/30"
        style={{ touchAction: "pan-x pan-y" }}
      >
        {loading ? (
          <p className="mx-auto pt-10 text-sm text-muted-foreground">
            Loading PDF…
          </p>
        ) : (
          /* shrink-0: a flex item wider than its container gets visually
             squashed (aspect broken) unless shrinking is disabled.
             mx-auto (NOT justify-center on the scroller): auto margins
             center the page when it fits but collapse to 0 when it is
             wider than the viewport — justify-center would push the left
             half of the overflow out of reach (scrollLeft >= 0) */
          <canvas
            ref={(c) => {
              canvasRef.current = c;
              if (c) engine.attach(c);
            }}
            className="mx-auto my-2 max-w-none shrink-0 shadow-lg"
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
