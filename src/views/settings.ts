/* views/settings.ts — connection, proxy, theme, data, app-update check */
import {
  NATIVE,
  APP_NAME,
  APP_VERSION,
  REPO,
  S,
  DEFAULT_SETTINGS,
  saveSettings,
  applyTheme,
} from "../config";
import {
  $,
  requireEl,
  bn,
  esc,
  fmtMB,
  toast,
  viewHead,
  errMessage,
  storageEstimate,
} from "../utils";
import { DB } from "../db";
import { apiGet } from "../net";
import { checkForUpdate } from "../updater";

interface ApiEnvelope<T> {
  data?: T[];
}

export async function renderSettings() {
  const st = S.settings;
  const est = await storageEstimate();
  requireEl("#view").innerHTML =
    `<div class="page">${viewHead("Settings", "Connection, appearance & data")}
    <div class="sect">Connection</div>
    <div class="card" style="padding:16px">
      <div class="field"><label>API URL</label>
        <input type="url" id="s-api" value="${esc(st.apiUrl)}" spellcheck="false">
        <div class="hint">The original app's backend (Laravel).</div></div>
      <div class="field"><label>API key</label>
        <div class="withbtn"><input type="text" id="s-key" value="${esc(st.apiKey)}" spellcheck="false" autocomplete="off">
        <button class="btn ghost sm" id="s-eye" type="button">Show</button></div>
        <div class="hint">If the key changes (403 errors), extract the new key from the latest APK and paste it here.</div></div>
      <button class="btn" id="s-save">Save & test</button>
      <span id="s-testout" style="margin-left:10px"></span>
    </div>
    ${
      !NATIVE
        ? `
    <div class="sect">Web proxy (PDF)</div>
    <div class="card" style="padding:16px">
      <div class="switchrow"><div class="sm"><div class="t">Use proxy</div>
        <div class="d">The PDF server has no CORS — files are fetched through Netlify's <code>/pdf/*</code> reverse proxy.</div></div>
        <label class="switch"><input type="checkbox" id="s-proxy" ${st.useProxyOnWeb ? "checked" : ""}><i></i></label></div>
      <div class="field"><label>Proxy path</label>
        <input type="text" id="s-pp" value="${esc(st.proxyPrefix)}" spellcheck="false"></div>
    </div>`
        : ""
    }
    <div class="sect">Downloads</div>
    <div class="card" style="padding:16px">
      <div class="field"><label>Chapters at a time</label>
        <select id="s-conc">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${st.concurrency === n ? "selected" : ""}>${n}</option>`).join("")}</select></div>
    </div>
    <div class="sect">Appearance</div>
    <div class="card" style="padding:16px">
      <div class="field"><label>Theme</label>
        <select id="s-theme">
          <option value="auto" ${st.theme === "auto" ? "selected" : ""}>Follow system</option>
          <option value="light" ${st.theme === "light" ? "selected" : ""}>Light</option>
          <option value="dark" ${st.theme === "dark" ? "selected" : ""}>Dark</option>
        </select></div>
    </div>
    <div class="sect">App update</div>
    <div class="card" style="padding:16px">
      <div class="switchrow"><div class="sm"><div class="t">${APP_NAME} v${APP_VERSION}</div>
        <div class="d">When a new version is out, a banner appears on Home (from GitHub Releases).</div></div></div>
      <button class="btn soft sm" id="s-upd">Check for update</button>
      <span id="s-updout" style="margin-left:10px"></span>
    </div>
    <div class="sect">Data</div>
    <div class="card" style="padding:16px">
      <div class="u" style="color:var(--muted);font-size:.85rem">
        ${est ? `Used: ${fmtMB(est.usage)} / ${fmtMB(est.quota)}` : "—"}
      </div>
      <button class="btn ghost sm" id="s-clear" style="margin-top:10px;color:var(--danger)">Delete all downloads</button>
    </div>
    <div class="sect">About</div>
    <div class="card" style="padding:16px;font-size:.85rem;color:var(--muted);line-height:1.8">
      <b style="color:var(--text)">${APP_NAME} v${APP_VERSION}</b> <code>${REPO}</code><br>
      A lightweight client for reading Class 9-10 guide books — Android and web from one codebase.<br>
      The catalog and PDFs come from the original "Class 9 All Subject Books" app's server
      (reverse-engineered with apkscope). For students' personal study only —
      the books belong to their publishers. If you like it, use the original app too.
    </div>
    <div class="footnote">${APP_NAME} · ${new Date().getFullYear()}</div>
  </div>`;
  $("#s-eye")?.addEventListener("click", () => {
    const k = $<HTMLInputElement>("#s-key");
    const eye = $("#s-eye");
    if (!k || !eye) return;
    const showing = k.dataset.show === "1";
    k.dataset.show = showing ? "" : "1";
    eye.textContent = showing ? "Show" : "Hide";
  });
  $("#s-save")?.addEventListener("click", async () => {
    const api = $<HTMLInputElement>("#s-api");
    const key = $<HTMLInputElement>("#s-key");
    const proxy = $<HTMLInputElement>("#s-proxy");
    const pp = $<HTMLInputElement>("#s-pp");
    const conc = $<HTMLSelectElement>("#s-conc");
    const theme = $<HTMLSelectElement>("#s-theme");
    S.settings.apiUrl = api?.value.trim() || DEFAULT_SETTINGS.apiUrl;
    S.settings.apiKey = key?.value.trim() || DEFAULT_SETTINGS.apiKey;
    if (!NATIVE) {
      S.settings.useProxyOnWeb = proxy?.checked ?? S.settings.useProxyOnWeb;
      S.settings.proxyPrefix = pp?.value.trim() || "/pdf/";
    }
    S.settings.concurrency = Number.parseInt(conc?.value || "2", 10) || 2;
    S.settings.theme = theme?.value || "auto";
    saveSettings();
    applyTheme();
    const out = $("#s-testout");
    if (!out) return;
    out.innerHTML = '<span class="spinner"></span>';
    try {
      const d = await apiGet<ApiEnvelope<unknown>>("categories", {
        parent: 18203,
        limit: 1,
      });
      out.innerHTML = `<span class="chip ok">Connection OK (${bn((d.data || []).length)} items)</span>`;
      toast("Settings saved — API is working", "ok");
    } catch (e) {
      out.innerHTML = `<span class="chip warn">Failed: ${esc(errMessage(e))}</span>`;
      toast(`API test failed: ${errMessage(e)}`, "err");
    }
  });
  $("#s-upd")?.addEventListener("click", async () => {
    const out = $("#s-updout");
    if (!out) return;
    out.innerHTML = '<span class="spinner"></span>';
    const upd = await checkForUpdate();
    out.innerHTML = upd
      ? `<span class="chip warn">v${bn(upd.latest)} available</span> <button class="btn sm" id="s-upd-dl" style="margin-left:6px">Download</button>`
      : `<span class="chip ok">Up to date (v${bn(APP_VERSION)})</span>`;
    if (upd)
      $("#s-upd-dl")?.addEventListener("click", () =>
        window.open(upd.apkUrl, "_blank"),
      );
  });
  $("#s-theme")?.addEventListener("change", () => {
    const theme = $<HTMLSelectElement>("#s-theme");
    S.settings.theme = theme?.value || "auto";
    saveSettings();
    applyTheme();
  });
  $("#s-clear")?.addEventListener("click", async (e) => {
    const b = e.currentTarget;
    if (!(b instanceof HTMLButtonElement)) return;
    if (b.dataset.confirm) {
      await DB.clearAll();
      toast("All downloads deleted");
      void renderSettings();
    } else {
      b.dataset.confirm = "1";
      b.textContent = "Sure? Tap again";
      setTimeout(() => {
        if (b.isConnected) {
          delete b.dataset.confirm;
          b.textContent = "Delete all downloads";
        }
      }, 3000);
    }
  });
}
