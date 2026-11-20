/* router.ts — minimal hash router (no framework)
   main.ts provides the route handler via initRouter(); views use go() */

export interface Route {
  name: string;
  args: string[];
}

const ROUTES: Record<string, string> = {
  "": "home",
  home: "home",
  branch: "branch",
  book: "book",
  library: "library",
  settings: "settings",
  read: "read",
  "read-last": "read-last",
};

export function parseHash(): Route {
  const h = location.hash.replace(/^#\/?/, "");
  const parts = h.split("/").filter(Boolean);
  const name = ROUTES[parts[0] || ""] || "home";
  return { name, args: parts.slice(1) };
}

export function go(hash: string) {
  location.hash = hash;
}

export function initRouter(onRoute: (route: Route) => void) {
  window.addEventListener("hashchange", () => {
    onRoute(parseHash());
    window.scrollTo(0, 0);
  });
}
