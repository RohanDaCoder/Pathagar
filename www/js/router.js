/* router.js — minimal hash router (no framework)
   main.js provides the route handler via initRouter(); views use go() */

const ROUTES = {
  '': 'home', 'home': 'home',
  'branch': 'branch', 'book': 'book',
  'library': 'library', 'settings': 'settings',
  'read': 'read', 'read-last': 'read-last',
};

export function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  const name = ROUTES[parts[0] || ''] || 'home';
  return { name, args: parts.slice(1) };
}

export function go(hash) { location.hash = hash; }

export function initRouter(onRoute) {
  window.addEventListener('hashchange', () => { onRoute(parseHash()); window.scrollTo(0, 0); });
}
