/* main.js — composition root: router wiring, view dispatcher, SW, guards */
import { NATIVE, S, applyTheme } from './config.js';
import { $, $$, svgWarn, esc } from './utils.js';
import { loadSnapshot } from './catalog.js';
import { DL } from './dlqueue.js';
import { parseHash, initRouter, go } from './router.js';
import { openReader } from './reader.js';
import { renderHome } from './views/home.js';
import { renderBranch } from './views/branch.js';
import { renderBook } from './views/book.js';
import { renderLibrary } from './views/library.js';
import { renderSettings } from './views/settings.js';

/* the download queue opens finished chapters through the reader */
DL.openChapter = openReader;

async function render() {
  const r = S.route;
  $$('#botnav a').forEach(a => a.classList.toggle('active', a.dataset.nav === r.name));
  $('#reader').classList.remove('open');
  try {
    if (r.name === 'home') await renderHome();
    else if (r.name === 'branch') await renderBranch(r.args[0]);
    else if (r.name === 'book') await renderBook(r.args[0]);
    else if (r.name === 'library') await renderLibrary();
    else if (r.name === 'settings') await renderSettings();
    else if (r.name === 'read') await openReader(r.args[0]);
    else if (r.name === 'read-last') {
      const last = localStorage.getItem('ptg:lastRead');
      if (last) await openReader(last); else go('#/home');
    }
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="empty">${svgWarn}<div class="t">Something went wrong</div>
      <div>${esc(e.message || '')}</div></div>`;
  }
}

applyTheme();
(async () => {
  await loadSnapshot();
  if (!location.hash) location.hash = '#/home';
  S.route = parseHash();
  render();
})();
initRouter((route) => { S.route = route; render(); });

/* PWA service worker — web + http(s) only (Capacitor serves its own copy) */
if ('serviceWorker' in navigator && !NATIVE && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* don't close the tab while downloads are running */
window.addEventListener('beforeunload', (e) => {
  const busy = [...S.dl.values()].some(s => s.status === 'downloading' || s.status === 'queued');
  if (busy) { e.preventDefault(); e.returnValue = ''; }
});
