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
  const label = meta?.label || 'গাইড';
  $('#view').innerHTML = `<div class="page">${viewHead(label, 'বই বাছাই করুন')}
    ${crumbs(label)}<div class="list" id="rows"></div></div>`;
  const rows = $('#rows');
  rows.innerHTML = '<div class="sk"></div>'.repeat(6);
  let data;
  try { data = await getBooks(branchId); } catch (e) {
    rows.innerHTML = `<div class="empty">${svgWarn}<div class="t">তালিকা আনা যায়নি</div>
      <div>${e.status === 403 ? 'API কী বাতিল হয়েছে বলে মনে হচ্ছে — সেটিংসে নতুন কী দিন।' : esc(e.message || 'নেটওয়ার্ক সমস্যা')}</div>
      <button class="btn soft sm" id="retrybtn">আবার চেষ্টা করুন</button></div>`;
    $('#retrybtn').onclick = () => renderBranch(branchId);
    return;
  }
  const savedByBook = {};
  (await DB.allMeta()).forEach(m => { savedByBook[m.bookId] = (savedByBook[m.bookId] || 0) + 1; });
  rows.innerHTML = (data.stale ? `<div class="banner warn">${svgOffline} অফলাইন — সংরক্ষিত তালিকা দেখানো হচ্ছে</div>` : '') +
    (data.items.length ? data.items.map(bk => `
    <div class="row" data-book="${bk.id}">
      ${bk.image ? `<img class="cover" loading="lazy" src="${esc(bk.image)}" alt="">`
                 : `<div class="cover">${esc((bk.name || 'বই').trim().charAt(0))}</div>`}
      <div class="rmain"><div class="rtitle">${esc(bk.name)}</div>
        <div class="rsub">
          <span>${bn(meta?.books.find(x => x.id === bk.id)?.chapters ?? '…')} অধ্যায়</span>
          ${savedByBook[bk.id] ? `<span class="chip ok">✓ ${bn(savedByBook[bk.id])} সেভ</span>` : ''}
        </div></div>
      ${svgChev}
    </div>`).join('') : `<div class="empty">${svgBookIco}<div class="t">এই শাখায় কোনো বই নেই</div></div>`);
  $$('#rows .row').forEach(el => el.onclick = () => {
    const id = el.dataset.book;
    const name = $('.rtitle', el).textContent;
    S.bookCtx.set(id, { id, name, branchId });
    go('#/book/' + id);
  });
}
