/* views/branch.js — book list of one guide branch */
import { S } from '../config.js';
import { $, $$, bn, esc, viewHead, crumbs, svgChev, svgWarn, svgOffline, svgBookIco } from '../utils.js';
import { DB } from '../db.js';
import { loadSnapshot, getBooks } from '../catalog.js';
import { go } from '../router.js';

export async function renderBranch(branchId) {
  branchId = parseInt(branchId, 10);
  const snap = await loadSnapshot();
  const meta = snap.branches.find(b => b.id === branchId);
  const label = meta?.label || 'Guide';
  $('#view').innerHTML = `<div class="page">${viewHead(label, 'Pick a book')}
    ${crumbs(label)}<div class="list" id="rows"></div></div>`;
  const rows = $('#rows');
  rows.innerHTML = '<div class="sk"></div>'.repeat(6);
  let data;
  try { data = await getBooks(branchId); } catch (e) {
    rows.innerHTML = `<div class="empty">${svgWarn}<div class="t">Couldn't load the list</div>
      <div>${e.status === 403 ? 'The API key seems to be revoked — set a new one in Settings.' : esc(e.message || 'Network problem')}</div>
      <button class="btn soft sm" id="retrybtn">Try again</button></div>`;
    $('#retrybtn').onclick = () => renderBranch(branchId);
    return;
  }
  const savedByBook = {};
  (await DB.allMeta()).forEach(m => { savedByBook[m.bookId] = (savedByBook[m.bookId] || 0) + 1; });
  rows.innerHTML = (data.stale ? `<div class="banner warn">${svgOffline} Offline — showing the saved list</div>` : '') +
    (data.items.length ? data.items.map(bk => `
    <div class="row" data-book="${bk.id}">
      ${bk.image ? `<img class="cover" loading="lazy" src="${esc(bk.image)}" alt="">`
                 : `<div class="cover">${esc((bk.name || 'Book').trim().charAt(0))}</div>`}
      <div class="rmain"><div class="rtitle">${esc(bk.name)}</div>
        <div class="rsub">
          <span>${bn(meta?.books.find(x => x.id === bk.id)?.chapters ?? '…')} chapters</span>
          ${savedByBook[bk.id] ? `<span class="chip ok">✓ ${bn(savedByBook[bk.id])} saved</span>` : ''}
        </div></div>
      ${svgChev}
    </div>`).join('') : `<div class="empty">${svgBookIco}<div class="t">No books in this branch</div></div>`);
  $$('#rows .row').forEach(el => el.onclick = () => {
    const id = el.dataset.book;
    const name = $('.rtitle', el).textContent;
    S.bookCtx.set(id, { id, name, branchId });
    go('#/book/' + id);
  });
}
