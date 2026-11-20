/* main.tsx — composition root: React mount, theme, SW registration, guards */

// eslint-disable-next-line import/no-unassigned-import -- css side-effect import (vite)
import "@/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { NATIVE, S } from "@/config";
import { applyTheme } from "@/lib/theme";
import { DL } from "@/dlqueue";
import App from "@/App";

/* the download queue opens finished chapters through the reader
   (hash navigation — works from outside React) */
DL.openChapter = (id) => {
  window.location.hash = `#/read/${id}`;
};

/* don't close the tab while downloads are running */
window.addEventListener("beforeunload", (e) => {
  const busy = [...S.dl.values()].some(
    (s) => s.status === "downloading" || s.status === "queued",
  );
  if (busy) {
    e.preventDefault();
    e.returnValue = "";
  }
});

applyTheme(S.settings.theme);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* PWA service worker — web + http(s) only (Capacitor serves its own copy) */
if (
  "serviceWorker" in navigator &&
  !NATIVE &&
  location.protocol.startsWith("http")
) {
  void registerSW({ immediate: true });
}
