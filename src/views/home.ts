/* views/home.ts — branch cards, library shortcut, update banner */
import { APP_NAME, APP_VERSION } from "../config";
import {
  $,
  requireEl,
  $$,
  bn,
  esc,
  fmtMB,
  viewHead,
  svgChev,
  svgLibrary,
  svgUpdate,
  svgOffline,
  BRANCH_ICONS,
  BRANCH_BG,
  svgBookIco,
} from "../utils";
import { DB } from "../db";
import { loadSnapshot } from "../catalog";
import { go } from "../router";
import { checkForUpdate, skipVersion } from "../updater";

export async function renderHome() {
  const snap = loadSnapshot();
  const metas = await DB.allMeta();
  const totalMB = metas.reduce((a, m) => a + (m.size || 0), 0);
  const savedByBranch: Record<string, number> = {};
  for (const m of metas) {
    if (m.branchId)
      savedByBranch[m.branchId] = (savedByBranch[m.branchId] || 0) + 1;
  }
  const upd = await checkForUpdate();

  /* GitHub Pages mirrors the app but has no /pdf reverse proxy — downloads
     need the Netlify deployment or the Android APK. Say so instead of failing silently. */
  const pagesDemo = location.hostname.endsWith(".github.io")
    ? `<div class="banner warn">${svgOffline} Demo build — PDF downloads need the Netlify deployment or the Android app (GitHub Pages has no PDF proxy). Browsing and offline reading work.</div>`
    : "";

  const banner =
    upd && !upd.skipped
      ? `
    <div class="banner info" id="updbanner" style="align-items:center">
      ${svgUpdate}
      <div style="flex:1;min-width:0">
        <b>New version v${bn(upd.latest)}</b> is available.
        <div style="font-size:.75rem;opacity:.85">Current: v${bn(upd.current)} — download and install the update.</div>
      </div>
      <button class="btn sm" id="upd-dl">Download</button>
      <button class="btn ghost sm" id="upd-skip">Later</button>
    </div>`
      : "";

  requireEl("#view").innerHTML = `<div class="page">
    ${banner}
    ${pagesDemo}
    ${viewHead(APP_NAME, "Class 9-10 guide books · offline library", true)}
    ${
      metas.length
        ? `
    <div class="card quick-card" data-go="#/library">
      <div class="qicon">${svgLibrary}</div>
      <div><div class="qtitle">My Library</div>
      <div class="qsub">${bn(metas.length)} chapters · ${fmtMB(totalMB)}</div></div>
      ${svgChev}
    </div>`
        : ""
    }
    <div class="branch-grid">
      ${snap.branches
        .map(
          (b) => `
        <div class="card branch-card" data-branch="${b.id}">
          <div class="bicon ${BRANCH_BG[b.id] || "bg-1"}">${BRANCH_ICONS[b.id] || svgBookIco}</div>
          <div style="min-width:0">
            <h3>${esc(b.label.replace(/\s*\(.*?\)\s*$/, ""))}</h3>
            <div class="meta">${bn(b.books.length)} books · ${bn(b.total_chapters)} chapters</div>
            ${savedByBranch[String(b.id)] ? `<div style="margin-top:4px"><span class="chip ok">✓ ${bn(savedByBranch[String(b.id)])} saved</span></div>` : ""}
          </div>
          ${svgChev}
        </div>`,
        )
        .join("")}
    </div>
    <div class="footnote">${APP_NAME} v${bn(APP_VERSION)} — download chapters and read them without internet.<br>
    Source: open catalog of the "Class 9 All Subject Books" app (for students' personal use).</div>
  </div>`;

  if (upd && !upd.skipped) {
    $("#upd-dl")?.addEventListener("click", () =>
      window.open(upd.apkUrl, "_blank"),
    );
    $("#upd-skip")?.addEventListener("click", () => {
      skipVersion(upd.latest);
      renderHome();
    });
  }
  $$(".branch-card").forEach((el) => {
    el.addEventListener("click", () => go(`#/branch/${el.dataset.branch}`));
  });
  const q = $(".quick-card");
  if (q) q.addEventListener("click", () => go("#/library"));
  $("#navlast")?.classList.toggle(
    "hide",
    !localStorage.getItem("ptg:lastRead"),
  );
}
