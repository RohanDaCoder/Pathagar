/* views/home.js — branch cards, library shortcut, update banner */
import { APP_NAME, APP_VERSION, S } from '../config.js';
import { $, $$, bn, esc, fmtMB, viewHead, svgChev, svgLibrary, svgUpdate, BRANCH_ICONS, BRANCH_BG, svgBookIco } from '../utils.js';
import { DB } from '../db.js';
import { loadSnapshot } from '../catalog.js';
import { go } from '../router.js';
import { checkForUpdate, skipVersion } from '../updater.js';

export async function renderHome() {
  const snap = await loadSnapshot();
  const metas = await DB.allMeta();
  const totalMB = metas.reduce((a, m) => a + (m.size || 0), 0);
  const savedByBranch = {};
  metas.forEach(m => { if (m.branchId) savedByBranch[m.branchId] = (savedByBranch[m.branchId] || 0) + 1; });
  const upd = await checkForUpdate();

  const banner = (upd && !upd.skipped) ? `
    <div class="banner info" id="updbanner" style="align-items:center">
      ${svgUpdate}
      <div style="flex:1;min-width:0">
        <b>নতুন ভার্সন v${bn(upd.latest)}</b> এসেছে।
        <div style="font-size:.75rem;opacity:.85">বর্তমান: v${bn(upd.current)} — আপডেটটি ডাউনলোড করে ইনস্টল করুন।</div>
      </div>
      <button class="btn sm" id="upd-dl">ডাউনলোড</button>
      <button class="btn ghost sm" id="upd-skip">পরে</button>
    </div>` : '';

  $('#view').innerHTML = `<div class="page">
    ${banner}
    ${viewHead(APP_NAME, 'ক্লাস ৯-১০ গাইড বই · অফলাইন লাইব্রেরি', true)}
    ${metas.length ? `
    <div class="card quick-card" data-go="#/library">
      <div class="qicon">${svgLibrary}</div>
      <div><div class="qtitle">আমার লাইব্রেরি</div>
      <div class="qsub">${bn(metas.length)} অধ্যায় · ${fmtMB(totalMB)}</div></div>
      ${svgChev}
    </div>` : ''}
    <div class="branch-grid">
      ${snap.branches.map(b => `
        <div class="card branch-card" data-branch="${b.id}">
          <div class="bicon ${BRANCH_BG[b.id] || 'bg-1'}">${BRANCH_ICONS[b.id] || svgBookIco}</div>
          <div style="min-width:0">
            <h3>${esc(b.label.replace(/\s*\(.*?\)\s*$/, ''))}</h3>
            <div class="meta">${bn(b.books.length)} বই · ${bn(b.total_chapters)} অধ্যায়</div>
            ${savedByBranch[b.id] ? `<div style="margin-top:4px"><span class="chip ok">✓ ${bn(savedByBranch[b.id])} অধ্যায় সেভ</span></div>` : ''}
          </div>
          ${svgChev}
        </div>`).join('')}
    </div>
    <div class="footnote">${APP_NAME} v${bn(APP_VERSION)} — অধ্যায় ডাউনলোড করে ইন্টারনেট ছাড়াই পড়ুন।<br>
    সূত্র: Class 9 All Subject Books অ্যাপের ওপেন ক্যাটালগ (শিক্ষার্থীদের ব্যক্তিগত ব্যবহারের জন্য)।</div>
  </div>`;

  if (upd && !upd.skipped) {
    $('#upd-dl').onclick = () => window.open(upd.apkUrl, '_blank');
    $('#upd-skip').onclick = () => { skipVersion(upd.latest); renderHome(); };
  }
  $$('.branch-card').forEach(el => el.onclick = () => go('#/branch/' + el.dataset.branch));
  const q = $('.quick-card'); if (q) q.onclick = () => go('#/library');
  $('#navlast').classList.toggle('hide', !localStorage.getItem('ptg:lastRead'));
}
