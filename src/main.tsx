/* main.tsx — composition root: React mount, theme, SW registration, guards. */

// eslint-disable-next-line import/no-unassigned-import -- css side-effect import (vite)
import "@/styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { settings } from "@/config";
import { applyTheme } from "@/lib/theme";
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

/* PWA service worker — http(s) only (file:// has no SW) */
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  void registerSW({ immediate: true });
}
