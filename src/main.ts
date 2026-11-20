/* main.ts — composition root: router wiring, view dispatcher, SW, guards */
// eslint-disable-next-line import/no-unassigned-import -- css side-effect import (vite)
import "./app.css";
import { registerSW } from "virtual:pwa-register";
import { NATIVE, S, applyTheme } from "./config";
import { $, $$, svgWarn, esc, errMessage } from "./utils";
import { loadSnapshot } from "./catalog";
import { DL } from "./dlqueue";
import { parseHash, initRouter, go } from "./router";
import { openReader } from "./reader";
import { renderHome } from "./views/home";
import { renderBranch } from "./views/branch";
import { renderBook } from "./views/book";
import { renderLibrary } from "./views/library";
import { renderSettings } from "./views/settings";

/* the download queue opens finished chapters through the reader */
DL.openChapter = openReader;

async function render() {
  const r = S.route;
  $$("#botnav a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === r.name);
  });
  $("#reader")?.classList.remove("open");
  try {
    if (r.name === "home") await renderHome();
    else if (r.name === "branch") await renderBranch(r.args[0]);
    else if (r.name === "book") await renderBook(r.args[0]);
    else if (r.name === "library") await renderLibrary();
    else if (r.name === "settings") await renderSettings();
    else if (r.name === "read") await openReader(r.args[0]);
    else if (r.name === "read-last") {
      const last = localStorage.getItem("ptg:lastRead");
      if (last) await openReader(last);
      else go("#/home");
    }
  } catch (e) {
    console.error(e);
    const view = $("#view");
    if (view)
      view.innerHTML = `<div class="empty">${svgWarn}<div class="t">Something went wrong</div>
      <div>${esc(errMessage(e))}</div></div>`;
  }
}

applyTheme();
void (async () => {
  loadSnapshot();
  if (!location.hash) location.hash = "#/home";
  S.route = parseHash();
  void render();
})();
initRouter((route) => {
  S.route = route;
  void render();
});

/* PWA service worker — web + http(s) only (Capacitor serves its own copy) */
if (
  "serviceWorker" in navigator &&
  !NATIVE &&
  location.protocol.startsWith("http")
) {
  void registerSW({ immediate: true });
}

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
