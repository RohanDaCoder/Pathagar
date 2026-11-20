/* main.tsx — composition root: catalog bootstrap, React mount, theme, SW
   registration, guards. The first render waits for initCatalog() — every
   view reads the snapshot synchronously — so the ~320 KB snapshot chunk and
   the app code load as parallel chunks instead of one 700 KB bundle. */

// eslint-disable-next-line import/no-unassigned-import -- css side-effect import (vite)
import "@/styles.css";
import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { settings } from "@/config";
import { applyTheme } from "@/lib/theme";
import { initCatalog } from "@/catalog";
import { DL } from "@/downloads";
import { dlDialog } from "@/components/DownloadsPopup";
import App from "@/App";

/* the download queue opens finished chapters through the reader
   (hash navigation — works from outside React) */
DL.openChapter = (id) => {
  window.location.hash = `#/read/${id}`;
  dlDialog.close(); // the requested flow: popup closes once the PDF loads
};

/* don't close the tab while downloads are running */
window.addEventListener("beforeunload", (e) => {
  if (DL.busy()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

applyTheme(settings.theme);

function start(node: ReactNode) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>{node}</StrictMode>,
  );
}

/* offline-first start: one automatic retry if the snapshot chunk fails to
   fetch (the only exposed window is the very first visit, before the
   service worker has precached it) */
initCatalog()
  .then(() => start(<App />))
  .catch((e: unknown) => {
    console.error("catalog init failed, retrying once", e);
    setTimeout(() => {
      initCatalog()
        .then(() => start(<App />))
        .catch(() =>
          start(
            <div className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-lg font-bold">Couldn't start Pathagar</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                The offline catalog failed to load. Check your connection and
                try again.
              </p>
              <button
                type="button"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>,
          ),
        );
    }, 800);
  });

/* PWA service worker — http(s) only (file:// has no SW) */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  void registerSW({ immediate: true });
}
