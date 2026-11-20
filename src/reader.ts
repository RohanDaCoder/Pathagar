/* reader.ts — pdf.js viewer, renders downloaded PDFs from IndexedDB.
   pdf.js (npm pdfjs-dist@3.11, same 3.11 family as the old vendored copy) is
   dynamically imported so it lands in a lazy chunk with its own worker URL. */
import { NATIVE } from "./config";
import { $, bn, esc, toast, errMessage } from "./utils";
import { DB } from "./db";
import type { ChapterMeta } from "./types";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type PdfjsLib = typeof import("pdfjs-dist");

let pdfjs: PdfjsLib | null = null;

async function ensurePdfJs(): Promise<PdfjsLib> {
  if (pdfjs) return pdfjs;
  const [lib, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.js?url"),
  ]);
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  pdfjs = lib;
  return lib;
}

interface ReaderState {
  doc: PDFDocumentProxy;
  page: number;
  scale: number;
  fit: number;
  id: string;
  meta: ChapterMeta;
  task: RenderTask | null;
  taskId: number;
}

let R: ReaderState | null = null; // reader state

export function closeReader() {
  try {
    R?.task?.cancel();
  } catch {
    /* cancelling an already-finished render is fine */
  }
  R = null;
  $("#reader")?.classList.remove("open");
  const rd = $("#reader");
  if (rd) rd.innerHTML = "";
  if (location.hash.startsWith("#/read")) history.back();
}

async function renderPdfPage() {
  if (!R) return;
  const page = await R.doc.getPage(R.page);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const wrap = $("#rwrap");
  if (!wrap) return;
  if (!R.fit) {
    const v1 = page.getViewport({ scale: 1 });
    R.fit = Math.max(0.2, (wrap.clientWidth - 16) / v1.width);
    R.scale = R.fit;
  }
  const scale = Math.min(4, Math.max(0.25, R.scale));
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = $<HTMLCanvasElement>("#rcanvas");
  if (!canvas) return;
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  canvas.style.width = `${Math.floor(vp.width / dpr)}px`;
  $("#rload")?.remove();
  R.taskId = (R.taskId || 0) + 1;
  try {
    R.task?.cancel();
  } catch {
    /* already cancelled */
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  R.task = page.render({ canvasContext: ctx, viewport: vp });
  const pg = $("#rpg");
  if (pg) pg.textContent = `${bn(R.page)} / ${bn(R.doc.numPages)}`;
  const prev = $<HTMLButtonElement>("#rprev");
  const next = $<HTMLButtonElement>("#rnext");
  if (prev) prev.disabled = R.page <= 1;
  if (next) next.disabled = R.page >= R.doc.numPages;
  try {
    await R.task.promise;
  } catch {
    /* cancelled renders are fine */
  }
}

export async function openReader(id: string | number) {
  id = String(id);
  let meta: ChapterMeta | undefined;
  let blob: Blob | undefined;
  try {
    meta = await DB.getMeta(id);
    blob = await DB.getFile(id);
  } catch {
    /* fall through to the not-found toast */
  }
  if (!meta || !blob) {
    toast("File not found — download it first", "err");
    return;
  }
  localStorage.setItem("ptg:lastRead", id);
  DB.updateMeta(id, { lastOpened: Date.now() }).catch(() => {});
  const lib = await ensurePdfJs().catch((e: Error) => {
    toast(e.message, "err");
    return null;
  });
  if (!lib) return;
  const rd = $("#reader");
  if (!rd) return;
  rd.innerHTML = `
    <div class="rbar">
      <button id="rclose" title="Close"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="rtitle">${esc(meta.title)} · ${esc(meta.bookName || "")}</div>
      <button id="rzout" title="Zoom out">−</button>
      <button id="rzin" title="Zoom in">+</button>
      ${NATIVE ? "" : '<button id="ropen" title="Open in new tab">⤢</button>'}
    </div>
    <div class="rwrap" id="rwrap"><div class="loading" id="rload"><span class="spinner"></span>&nbsp; Loading PDF…</div><canvas id="rcanvas"></canvas></div>
    <div class="rnav">
      <button id="rprev">‹ Prev</button>
      <div class="pg" id="rpg">…</div>
      <button id="rnext">Next ›</button>
    </div>`;
  rd.classList.add("open");
  let doc: PDFDocumentProxy;
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    doc = await lib.getDocument({ data }).promise;
  } catch (e) {
    toast(`Could not open PDF: ${errMessage(e)}`, "err");
    closeReader();
    return;
  }
  if (!rd.classList.contains("open")) {
    void doc.destroy?.();
    return;
  } // closed meanwhile
  R = { doc, page: 1, scale: 0, fit: 0, id, meta, task: null, taskId: 0 };
  await renderPdfPage();

  $("#rclose")?.addEventListener("click", closeReader);
  $("#rprev")?.addEventListener("click", () => {
    if (R && R.page > 1) {
      R.page--;
      void renderPdfPage();
      const w = $("#rwrap");
      if (w) w.scrollTop = 0;
    }
  });
  $("#rnext")?.addEventListener("click", () => {
    if (R && R.page < R.doc.numPages) {
      R.page++;
      void renderPdfPage();
      const w = $("#rwrap");
      if (w) w.scrollTop = 0;
    }
  });
  $("#rzin")?.addEventListener("click", () => {
    if (R) {
      R.scale = Math.min(4, R.scale * 1.25);
      void renderPdfPage();
    }
  });
  $("#rzout")?.addEventListener("click", () => {
    if (R) {
      R.scale = Math.max(0.25, R.scale / 1.25);
      void renderPdfPage();
    }
  });
  const ropen = $<HTMLButtonElement>("#ropen");
  if (ropen)
    ropen.addEventListener("click", async () => {
      const b = await DB.getFile(id);
      if (!b) return;
      const u = URL.createObjectURL(b);
      window.open(u, "_blank");
      setTimeout(() => URL.revokeObjectURL(u), 120000);
    });
  let touchX: number | null = null;
  let touchY: number | null = null;
  const wrap = $("#rwrap");
  wrap?.addEventListener(
    "touchstart",
    (e) => {
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    },
    { passive: true },
  );
  wrap?.addEventListener(
    "touchend",
    (e) => {
      if (touchX == null || !R) return;
      const dx = e.changedTouches[0].clientX - touchX;
      const dy = e.changedTouches[0].clientY - (touchY ?? 0);
      touchX = null;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0 && R.page < R.doc.numPages) {
          R.page++;
          void renderPdfPage();
        } else if (dx > 0 && R.page > 1) {
          R.page--;
          void renderPdfPage();
        }
      }
    },
    { passive: true },
  );
}

document.addEventListener("keydown", (e) => {
  if (!R || !$("#reader")?.classList.contains("open")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown")
    $<HTMLButtonElement>("#rnext")?.click();
  else if (e.key === "ArrowLeft" || e.key === "PageUp")
    $<HTMLButtonElement>("#rprev")?.click();
  else if (e.key === "Escape") closeReader();
  else if (e.key === "+") $<HTMLButtonElement>("#rzin")?.click();
  else if (e.key === "-") $<HTMLButtonElement>("#rzout")?.click();
});
