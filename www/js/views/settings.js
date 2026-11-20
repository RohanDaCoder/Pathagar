/* views/settings.js — connection, proxy, theme, data, app-update check */
import { NATIVE, APP_NAME, APP_VERSION, REPO, S, DEFAULT_SETTINGS, saveSettings, applyTheme } from '../config.js';
import { $, bn, esc, fmtMB, toast, viewHead, storageEstimate } from '../utils.js';
import { DB } from '../db.js';
import { apiGet } from '../net.js';
import { checkForUpdate } from '../updater.js';

export async function renderSettings() {
  const st = S.settings;
  const est = await storageEstimate();
  $('#view').innerHTML = `<div class="page">${viewHead('সেটিংস', 'সংযোগ, চেহারা ও ডেটা')}
    <div class="sect">সংযোগ</div>
    <div class="card" style="padding:16px">
      <div class="field"><label>API ঠিকানা</label>
        <input type="url" id="s-api" value="${esc(st.apiUrl)}" spellcheck="false">
        <div class="hint">মূল অ্যাপের ব্যাকএন্ড (Laravel)।</div></div>
      <div class="field"><label>API কী</label>
        <div class="withbtn"><input type="text" id="s-key" value="${esc(st.apiKey)}" spellcheck="false" autocomplete="off">
        <button class="btn ghost sm" id="s-eye" type="button">দেখুন</button></div>
        <div class="hint">কী বদলালে (৪০৩ এরর এলে) নতুন APK থেকে কী বের করে এখানে বসান।</div></div>
      <button class="btn" id="s-save">সংরক্ষণ ও পরীক্ষা করুন</button>
      <span id="s-testout" style="margin-left:10px"></span>
    </div>
    ${!NATIVE ? `
    <div class="sect">ওয়েব প্রক্সি (PDF)</div>
    <div class="card" style="padding:16px">
      <div class="switchrow"><div class="sm"><div class="t">প্রক্সি ব্যবহার করুন</div>
        <div class="d">PDF সার্ভার CORS দেয় না — Netlify-এর <code>/pdf/*</code> রিভার্স প্রক্সি দিয়ে আনা হয়।</div></div>
        <label class="switch"><input type="checkbox" id="s-proxy" ${st.useProxyOnWeb ? 'checked' : ''}><i></i></label></div>
      <div class="field"><label>প্রক্সি পাথ</label>
        <input type="text" id="s-pp" value="${esc(st.proxyPrefix)}" spellcheck="false"></div>
    </div>` : ''}
    <div class="sect">ডাউনলোড</div>
    <div class="card" style="padding:16px">
      <div class="field"><label>একসাথে কতগুলো অধ্যায়</label>
        <select id="s-conc">${[1, 2, 3, 4].map(n => `<option value="${n}" ${st.concurrency === n ? 'selected' : ''}>${bn(n)}টা</option>`).join('')}</select></div>
    </div>
    <div class="sect">চেহারা</div>
    <div class="card" style="padding:16px">
      <div class="field"><label>থিম</label>
        <select id="s-theme">
          <option value="auto" ${st.theme === 'auto' ? 'selected' : ''}>সিস্টেম অনুযায়ী</option>
          <option value="light" ${st.theme === 'light' ? 'selected' : ''}>লাইট</option>
          <option value="dark" ${st.theme === 'dark' ? 'selected' : ''}>ডার্ক</option>
        </select></div>
    </div>
    <div class="sect">অ্যাপ আপডেট</div>
    <div class="card" style="padding:16px">
      <div class="switchrow"><div class="sm"><div class="t">${APP_NAME} v${APP_VERSION}</div>
        <div class="d">নতুন ভার্সন এলে হোমে ব্যানার দেখাবে (GitHub Releases থেকে)।</div></div></div>
      <button class="btn soft sm" id="s-upd">আপডেট চেক করুন</button>
      <span id="s-updout" style="margin-left:10px"></span>
    </div>
    <div class="sect">ডেটা</div>
    <div class="card" style="padding:16px">
      <div class="u" style="color:var(--muted);font-size:.85rem">
        ${est ? `ব্যবহৃত: ${fmtMB(est.usage)} / ${fmtMB(est.quota)}` : '—'}
      </div>
      <button class="btn ghost sm" id="s-clear" style="margin-top:10px;color:var(--danger)">সব ডাউনলোড মুছুন</button>
    </div>
    <div class="sect">পরিচিতি</div>
    <div class="card" style="padding:16px;font-size:.85rem;color:var(--muted);line-height:1.8">
      <b style="color:var(--text)">${APP_NAME} v${APP_VERSION}</b> <code>${REPO}</code><br>
      ক্লাস ৯-১০ এর গাইড বই পড়ার হালকা ক্লায়েন্ট — Android ও ওয়েব একই কোড থেকে।<br>
      ক্যাটালগ ও PDF আসে মূল "Class 9 All Subject Books" অ্যাপের সার্ভার থেকে
      (reverse-engineered with apkscope)। এটি শিক্ষার্থীদের ব্যক্তিগত পড়াশোনার জন্য —
      বইগুলোর স্বত্ব প্রকাশকদের। ভালো লাগলে মূল অ্যাপটিও ব্যবহার করুন।
    </div>
    <div class="footnote">${APP_NAME} · ${new Date().getFullYear()}</div>
  </div>`;
  $('#s-eye').onclick = () => {
    const k = $('#s-key');
    const showing = k.dataset.show === '1';
    k.dataset.show = showing ? '' : '1';
    $('#s-eye').textContent = showing ? 'দেখুন' : 'লুকান';
  };
  $('#s-save').onclick = async () => {
    S.settings.apiUrl = $('#s-api').value.trim() || DEFAULT_SETTINGS.apiUrl;
    S.settings.apiKey = $('#s-key').value.trim() || DEFAULT_SETTINGS.apiKey;
    if (!NATIVE) { S.settings.useProxyOnWeb = $('#s-proxy').checked; S.settings.proxyPrefix = $('#s-pp').value.trim() || '/pdf/'; }
    S.settings.concurrency = parseInt($('#s-conc').value, 10) || 2;
    S.settings.theme = $('#s-theme').value;
    saveSettings(); applyTheme();
    const out = $('#s-testout');
    out.innerHTML = '<span class="spinner"></span>';
    try {
      const d = await apiGet('categories', { parent: 18203, limit: 1 });
      out.innerHTML = `<span class="chip ok">সংযোগ ঠিক আছে (${bn((d.data || []).length)} আইটেম)</span>`;
      toast('সেটিংস সংরক্ষিত — API কাজ করছে', 'ok');
    } catch (e) {
      out.innerHTML = `<span class="chip warn">ব্যর্থ: ${esc(e.message)}</span>`;
      toast('API পরীক্ষা ব্যর্থ: ' + e.message, 'err');
    }
  };
  $('#s-upd').onclick = async () => {
    const out = $('#s-updout');
    out.innerHTML = '<span class="spinner"></span>';
    const upd = await checkForUpdate();
    out.innerHTML = upd
      ? `<span class="chip warn">v${bn(upd.latest)} এসেছে</span> <button class="btn sm" id="s-upd-dl" style="margin-left:6px">ডাউনলোড</button>`
      : `<span class="chip ok">সর্বশেষ ভার্সন (v${bn(APP_VERSION)})</span>`;
    if (upd) $('#s-upd-dl').onclick = () => window.open(upd.apkUrl, '_blank');
  };
  $('#s-theme').onchange = () => { S.settings.theme = $('#s-theme').value; saveSettings(); applyTheme(); };
  $('#s-clear').onclick = async (e) => {
    const b = e.currentTarget;
    if (b.dataset.confirm) { await DB.clearAll(); toast('সব ডাউনলোড মুছে ফেলা হয়েছে'); renderSettings(); }
    else { b.dataset.confirm = '1'; b.textContent = 'নিশ্চিত? আবার চাপ দিন'; setTimeout(() => { if (b.isConnected) { delete b.dataset.confirm; b.textContent = 'সব ডাউনলোড মুছুন'; } }, 3000); }
  };
}
