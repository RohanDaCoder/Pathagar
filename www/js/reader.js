/* reader.js — pdf.js viewer, renders downloaded PDFs from IndexedDB */
import { NATIVE } from './config.js';
import { $, bn, esc, toast } from './utils.js';
import { DB } from './db.js';

let R = null; // reader state

function ensurePdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!ensurePdfJs.p) {
    ensurePdfJs.p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/pdfjs/pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
        resolve();
      };
      s.onerror = () => reject(new Error('PDF ভিউয়ার লোড হয়নি'));
      document.head.appendChild(s);
    });
  }
  return ensurePdfJs.p;
}

export function closeReader() {
  if (R?.task?.cancel) try { R.task.cancel(); } catch {}
  R = null;
  $('#reader').classList.remove('open');
  $('#reader').innerHTML = '';
  if (location.hash.startsWith('#/read')) history.back();
}

async function renderPdfPage() {
  if (!R) return;
  const page = await R.doc.getPage(R.page);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!R.fit) {
    const v1 = page.getViewport({ scale: 1 });
    R.fit = Math.max(0.2, ($('#rwrap').clientWidth - 16) / v1.width);
    R.scale = R.fit;
  }
  const scale = Math.min(4, Math.max(0.25, R.scale));
  const vp = page.getViewport({ scale: scale * dpr });
  const canvas = $('#rcanvas');
  canvas.width = Math.floor(vp.width);
  canvas.height = Math.floor(vp.height);
  canvas.style.width = Math.floor(vp.width / dpr) + 'px';
  const load = $('#rload'); if (load) load.remove();
  R.taskId = (R.taskId || 0) + 1;
  if (R.task?.cancel) try { R.task.cancel(); } catch {}
  R.task = page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
  $('#rpg').textContent = `${bn(R.page)} / ${bn(R.doc.numPages)}`;
  $('#rprev').disabled = R.page <= 1;
  $('#rnext').disabled = R.page >= R.doc.numPages;
  try { await R.task.promise; } catch (e) { /* cancelled renders are fine */ }
}

export async function openReader(id) {
  id = String(id);
  let meta = null, blob = null;
  try { meta = await DB.getMeta(id); blob = await DB.getFile(id); } catch {}
  if (!meta || !blob) { toast('ফাইলটি নেই — আগে ডাউনলোড করুন', 'err'); return; }
  localStorage.setItem('ptg:lastRead', id);
  DB.updateMeta(id, { lastOpened: Date.now() }).catch(() => {});
  try { await ensurePdfJs(); } catch (e) { toast(e.message, 'err'); return; }
  const rd = $('#reader');
  rd.innerHTML = `
    <div class="rbar">
      <button id="rclose" title="বন্ধ করুন"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg></button>
      <div class="rtitle">${esc(meta.title)} · ${esc(meta.bookName || '')}</div>
      <button id="rzout" title="ছোট করুন">−</button>
      <button id="rzin" title="বড় করুন">+</button>
      ${NATIVE ? '' : '<button id="ropen" title="নতুন ট্যাবে খুলুন">⤢</button>'}
    </div>
    <div class="rwrap" id="rwrap"><div class="loading" id="rload"><span class="spinner"></span>&nbsp; PDF লোড হচ্ছে…</div><canvas id="rcanvas"></canvas></div>
    <div class="rnav">
      <button id="rprev">‹ পূর্ববর্তী</button>
      <div class="pg" id="rpg">…</div>
      <button id="rnext">পরবর্তী ›</button>
    </div>`;
  rd.classList.add('open');
  let doc;
  try {
    const data = new Uint8Array(await blob.arrayBuffer());
    doc = await window.pdfjsLib.getDocument({ data }).promise;
  } catch (e) { toast('PDF খোলা যায়নি: ' + (e.message || ''), 'err'); closeReader(); return; }
  if (!rd.classList.contains('open')) { doc.destroy?.(); return; } // closed meanwhile
  R = { doc, page: 1, scale: 0, fit: 0, id, meta, task: null, taskId: 0 };
  await renderPdfPage();

  $('#rclose').onclick = closeReader;
  $('#rprev').onclick = () => { if (R && R.page > 1) { R.page--; renderPdfPage(); $('#rwrap').scrollTop = 0; } };
  $('#rnext').onclick = () => { if (R && R.page < R.doc.numPages) { R.page++; renderPdfPage(); $('#rwrap').scrollTop = 0; } };
  $('#rzin').onclick = () => { if (R) { R.scale = Math.min(4, R.scale * 1.25); renderPdfPage(); } };
  $('#rzout').onclick = () => { if (R) { R.scale = Math.max(0.25, R.scale / 1.25); renderPdfPage(); } };
  const ropen = $('#ropen');
  if (ropen) ropen.onclick = async () => {
    const b = await DB.getFile(id);
    const u = URL.createObjectURL(b);
    window.open(u, '_blank');
    setTimeout(() => URL.revokeObjectURL(u), 120000);
  };
  let touchX = null, touchY = null;
  $('#rwrap').addEventListener('touchstart', (e) => {
    touchX = e.touches[0].clientX; touchY = e.touches[0].clientY;
  }, { passive: true });
  $('#rwrap').addEventListener('touchend', (e) => {
    if (touchX == null || !R) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && R.page < R.doc.numPages) { R.page++; renderPdfPage(); }
      else if (dx > 0 && R.page > 1) { R.page--; renderPdfPage(); }
    }
  }, { passive: true });
}

document.addEventListener('keydown', (e) => {
  if (!R || !$('#reader').classList.contains('open')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') $('#rnext')?.click();
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') $('#rprev')?.click();
  else if (e.key === 'Escape') closeReader();
  else if (e.key === '+') $('#rzin')?.click();
  else if (e.key === '-') $('#rzout')?.click();
});
