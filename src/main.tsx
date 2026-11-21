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
import { UpdatePopup } from "@/components/UpdatePopup";
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

/* reload once for a service-worker takeover (loop guard timestamp first) */
const reloadForUpdate = () => {
  sessionStorage.setItem("pathagar-update-reload", String(Date.now()));
  window.location.reload();
};

/* PWA update flow — registerType "prompt": a new service worker WAITS and
   never silently replaces the running one (the default autoUpdate reloads
   the page with no announcement — exactly what we don't want mid-reading).
   Instead we announce it and apply it automatically: popup → countdown →
   activate → reload, so users always run the latest version, informed. */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  let applyUpdate: () => void = () => reloadForUpdate();
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      /* loop guard: a flip-flopping deploy must not reload-storm the tab */
      const last = Number(
        sessionStorage.getItem("pathagar-update-reload") || 0,
      );
      if (Date.now() - last < 30_000) return;
      const host = document.createElement("div");
      document.body.appendChild(host);
      createRoot(host).render(<UpdatePopup onReload={() => applyUpdate()} />);
    },
  });
  applyUpdate = () => {
    sessionStorage.setItem("pathagar-update-reload", String(Date.now()));
    void updateSW(true); // SKIP_WAITING → controllerchange → reload
    /* fallback: if activation hiccups, still land on the new version */
    setTimeout(() => window.location.reload(), 1500);
  };
  /* another tab may activate the waiting worker first — follow along */
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return; // first-ever install — nothing to reload
    const last = Number(sessionStorage.getItem("pathagar-update-reload") || 0);
    if (Date.now() - last < 30_000) return;
    reloadForUpdate();
  });
}
