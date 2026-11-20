/* views/branch.ts — book list of one guide branch */
import { S } from "../config";
import {
  $,
  requireEl,
  $$,
  bn,
  esc,
  viewHead,
  crumbs,
  svgChev,
  svgWarn,
  svgOffline,
  svgBookIco,
} from "../utils";
import { DB } from "../db";
import { loadSnapshot, getBooks } from "../catalog";
import { go } from "../router";
import type { Book, ListResult } from "../types";

export async function renderBranch(branchId: string | undefined) {
  const id = Number.parseInt(branchId || "", 10);
  const snap = loadSnapshot();
  const meta = snap.branches.find((b) => b.id === id);
  const label = meta?.label || "Guide";
  requireEl("#view").innerHTML =
    `<div class="page">${viewHead(label, "Pick a book")}
    ${crumbs(label)}<div class="list" id="rows"></div></div>`;
  const rows = requireEl("#rows");
  rows.innerHTML = '<div class="sk"></div>'.repeat(6);
  let data: ListResult<Book>;
  try {
    data = await getBooks(id);
  } catch (e) {
    const err = e as Error & { status?: number };
    rows.innerHTML = `<div class="empty">${svgWarn}<div class="t">Couldn't load the list</div>
      <div>${err.status === 403 ? "The API key seems to be revoked — set a new one in Settings." : esc(err.message || "Network problem")}</div>
      <button class="btn soft sm" id="retrybtn">Try again</button></div>`;
    $("#retrybtn")?.addEventListener("click", () => renderBranch(branchId));
    return;
  }
  const savedByBook: Record<string, number> = {};
  for (const m of await DB.allMeta())
    savedByBook[m.bookId] = (savedByBook[m.bookId] || 0) + 1;
  rows.innerHTML =
    (data.stale
      ? `<div class="banner warn">${svgOffline} Offline — showing the saved list</div>`
      : "") +
    (data.items.length
      ? data.items
          .map(
            (bk) => `
    <div class="row" data-book="${bk.id}">
      ${
        bk.image
          ? `<img class="cover" loading="lazy" src="${esc(bk.image)}" alt="">`
          : `<div class="cover">${esc((bk.name || "Book").trim().charAt(0))}</div>`
      }
      <div class="rmain"><div class="rtitle">${esc(bk.name)}</div>
        <div class="rsub">
          <span>${bn(meta?.books.find((x) => x.id === bk.id)?.chapters ?? "…")} chapters</span>
          ${savedByBook[String(bk.id)] ? `<span class="chip ok">✓ ${bn(savedByBook[String(bk.id)])} saved</span>` : ""}
        </div></div>
      ${svgChev}
    </div>`,
          )
          .join("")
      : `<div class="empty">${svgBookIco}<div class="t">No books in this branch</div></div>`);
  $$("#rows .row").forEach((el) => {
    el.addEventListener("click", () => {
      const bookId = el.dataset.book || "";
      const name = el.querySelector(".rtitle")?.textContent || "";
      S.bookCtx.set(bookId, { id: bookId, name, branchId: id });
      go(`#/book/${bookId}`);
    });
  });
}
