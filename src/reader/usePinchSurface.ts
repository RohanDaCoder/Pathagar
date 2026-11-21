/* reader/usePinchSurface.ts — the PDF area as an isolated pan/zoom surface
   (the page itself cannot zoom: user-scalable=no + no pinch-zoom token in
   touch-action, so the chrome never moves). One finger pans or, at fit zoom,
   swipes pages; two fingers pinch-resize the canvas live (CSS-only, 60fps);
   the crisp pdf.js re-render commits once on release, with the grabbed PDF
   point kept under the fingers. */

import { useEffect, useRef, type RefObject } from "react";
import { clampZoom } from "./pdfEngine";

export interface PinchSurfaceOpts {
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  /** fit-width/fit-page scale for the current viewport */
  fitScale: () => number;
  /** current zoom state (0 = auto-fit) */
  getZoom: () => number;
  /** commit a manual absolute zoom (pinch release) */
  setZoom: (z: number) => void;
  /** live zoom-percentage readout during the gesture */
  setZoomPct: (pct: number) => void;
  /** swipe page turn (only fires at fit zoom) */
  turnPage: (dir: 1 | -1) => void;
}

export function usePinchSurface(opts: PinchSurfaceOpts) {
  /* fresh callbacks every render; listeners bind once */
  const o = useRef(opts);
  useEffect(() => {
    o.current = opts;
  });

  useEffect(() => {
    const wrap = o.current.wrapRef.current;
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
      const canvas = o.current.canvasRef.current;
      if (!canvas || !anchor) return;
      const ratio = dist() / pinchStartDist;
      /* floor = current fit scale: a pinch-out stops once the page fully
         fits the viewport (same bound as the zoom-out button) */
      const z = clampZoom(pinchBaseZoom * ratio, o.current.fitScale());
      pinchRatio = z / pinchBaseZoom;
      canvas.style.width = `${Math.round(baseW * pinchRatio)}px`;
      canvas.style.height = `${Math.round(baseH * pinchRatio)}px`;
      /* keep the grabbed PDF point under the fingers */
      const rect = canvas.getBoundingClientRect();
      const mid = midpoint();
      wrap.scrollLeft += rect.left + anchor.x * pinchRatio - mid.x;
      wrap.scrollTop += rect.top + anchor.y * pinchRatio - mid.y;
      o.current.setZoomPct(Math.round(z * 100));
    };

    const commitPinch = () => {
      pinchStartDist = 0;
      anchor = null;
      const z = clampZoom(pinchBaseZoom * pinchRatio, o.current.fitScale());
      /* a no-op pinch must not lock in a manual zoom */
      if (Math.abs(z - (o.current.getZoom() || o.current.fitScale())) > 0.001)
        o.current.setZoom(z); // re-renders at the same size — no visual jump
    };

    const onStart = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1) {
        swipeStart = { x: e.clientX, y: e.clientY };
      } else if (pointers.size === 2) {
        swipeStart = null;
        const canvas = o.current.canvasRef.current;
        if (!canvas) return;
        pinchStartDist = dist();
        pinchBaseZoom = o.current.getZoom() || o.current.fitScale();
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
      if (o.current.getZoom() === 0) {
        const dx = e.clientX - swipeStart.x;
        const dy = e.clientY - swipeStart.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4)
          o.current.turnPage(dx < 0 ? 1 : -1);
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
  }, []);
}
