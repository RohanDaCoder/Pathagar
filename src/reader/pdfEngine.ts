/* reader/pdfEngine.ts — pdf.js lifecycle: document load, DPR-aware page
   render, render-task cancellation. pdfjs-dist is dynamically imported so it
   lands in a lazy chunk with its own worker URL. */

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

/* MIN_ZOOM is only an absolute safety net (pathological page sizes); the
   real zoom-out floor is dynamic — the reader passes the current fit scale,
   so a page can never shrink below "fully fits the viewport" (zooming out
   further would just trade page for gray gutters). */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5;
export const clampZoom = (z: number, min = MIN_ZOOM) =>
  Math.min(MAX_ZOOM, Math.max(min, z));

export class PdfEngine {
  private doc: PDFDocumentProxy | null = null;
  private loading: PDFDocumentLoadingTask | null = null;
  private task: RenderTask | null = null;
  private pageDims: { w: number; h: number } | null = null;
  private canvas: HTMLCanvasElement | null = null;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  get ready(): boolean {
    return this.doc !== null;
  }

  get numPages(): number {
    return this.doc?.numPages ?? 0;
  }

  /** Page size at scale 1 (null until the first render). */
  get dims(): { w: number; h: number } | null {
    return this.pageDims;
  }

  async load(data: Uint8Array): Promise<void> {
    this.destroy();
    const lib = await ensurePdfJs();
    const task = lib.getDocument({ data });
    this.loading = task;
    this.doc = await task.promise;
    this.pageDims = null;
  }

  async render(page: number, scale: number): Promise<void> {
    if (!this.doc || !this.canvas || !scale) return;
    const pg = await this.doc.getPage(page);
    this.pageDims = {
      w: pg.getViewport({ scale: 1 }).width,
      h: pg.getViewport({ scale: 1 }).height,
    };
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vp = pg.getViewport({ scale: clampZoom(scale) * dpr });
    this.canvas.width = Math.floor(vp.width);
    this.canvas.height = Math.floor(vp.height);
    this.canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
    this.canvas.style.height = `${Math.floor(vp.height / dpr)}px`;
    this.task?.cancel();
    this.task = pg.render({ canvas: this.canvas, viewport: vp });
    try {
      await this.task.promise;
    } catch {
      /* cancelled renders are fine */
    }
  }

  destroy() {
    this.task?.cancel();
    this.task = null;
    void this.loading?.destroy();
    this.loading = null;
    this.doc = null;
    this.pageDims = null;
  }
}
