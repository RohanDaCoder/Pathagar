/* views/library.ts — offline library: downloaded chapters grouped by book */
import {
  $,
  requireEl,
  $$,
  bn,
  esc,
  fmtMB,
  toast,
  viewHead,
  svgCheck,
  svgPlay,
  svgTrash,
  svgPdf,
  svgLibrary,
  storageEstimate,
} from "../utils";
import { DB } from "../db";
import { openReader } from "../reader";
import { go } from "../router";

export async function renderLibrary() {
  const metas = (await DB.allMeta()).sort(
    (a, b) => (b.addedAt || 0) - (a.addedAt || 0),
  );
  const est = await storageEstimate();
  const groups = new Map<string, typeof metas>();
  for (const m of metas) {
    let g = groups.get(m.bookName);
    if (!g) {
      g = [];
      groups.set(m.bookName, g);
    }
    g.push(m);
  }
  const totalMB = metas.reduce((a, m) => a + (m.size || 0), 0);
  let html = `<div class="page">${viewHead("My Library", `${bn(metas.length)} chapters · ${fmtMB(totalMB)}`)}`;
  if (est) {
    const pctUsed = Math.min(100, (est.usage / est.quota) * 100).toFixed(1);
    html += `<div class="card usage"><div class="u"><b>Storage</b> — ${fmtMB(est.usage)} / ${fmtMB(est.quota)} (${bn(pctUsed)}%)</div>
      <div class="bar"><i style="width:${Math.min(100, Number(pctUsed))}%"></i></div>
      <div class="u">Downloaded chapters can be read without internet.</div></div>`;
  }
  if (!metas.length) {
    html += `<div class="empty">${svgLibrary}<div class="t">Library is empty</div>
      <div>Pick a guide on Home and download its chapters — then read them offline here.</div>
      <button class="btn" style="margin-top:8px" data-go="#/home">Browse books</button></div>`;
  } else {
    for (const [gname, items] of groups) {
      html += `<div class="grp-title">${svgPdf}<span>${esc(gname)}</span><span class="cnt">${bn(items.length)} chapters</span></div>
      <div class="list">${items
        .map(
          (m) => `
        <div class="row done" data-del="${m.id}">
          <div class="chno">${svgPdf}</div>
          <div class="rmain"><div class="rtitle">${esc(m.title)}</div>
            <div class="rsub"><span>${fmtMB(m.size || 0)}</span><span>${new Date(m.addedAt).toLocaleDateString("en-GB")}</span></div></div>
          <button class="chbtn ok" data-read="${m.id}" title="Read">${svgPlay}</button>
          <button class="chbtn err" data-delbtn="${m.id}" title="Delete">${svgTrash}</button>
        </div>`,
        )
        .join("")}</div>`;
    }
    html += `<div style="display:flex;justify-content:center;margin-top:20px">
      <button class="btn ghost" id="clearall" style="color:var(--danger)">Delete all downloads</button></div>`;
  }
  html += `</div>`;
  requireEl("#view").innerHTML = html;
  $$("[data-read]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      openReader(b.dataset.read || "");
    });
  });
  $$("[data-delbtn]").forEach((b) => {
    b.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (b.dataset.confirm) {
        await DB.delFile(b.dataset.delbtn || "");
        toast("Deleted");
        renderLibrary();
      } else {
        b.dataset.confirm = "1";
        b.innerHTML = svgCheck;
        setTimeout(() => {
          if (b.isConnected) {
            delete b.dataset.confirm;
            b.innerHTML = svgTrash;
          }
        }, 2600);
      }
    });
  });
  $$("[data-del]").forEach((r) => {
    r.addEventListener("click", () => openReader(r.dataset.del || ""));
  });
  $$("[data-go]").forEach((b) => {
    b.addEventListener("click", () => go(b.dataset.go || "#/home"));
  });
  const ca = $("#clearall");
  ca?.addEventListener("click", async () => {
    if (ca.dataset.confirm) {
      await DB.clearAll();
      toast("Library cleared");
      renderLibrary();
    } else {
      ca.dataset.confirm = "1";
      ca.textContent = "Sure? Tap again";
      setTimeout(() => {
        if (ca.isConnected) {
          delete ca.dataset.confirm;
          ca.textContent = "Delete all downloads";
        }
      }, 3000);
    }
  });
}
