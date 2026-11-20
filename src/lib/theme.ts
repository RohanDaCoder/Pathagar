/* lib/theme.ts — theme application: auto follows the system preference (and
   keeps following it — the matchMedia change listener matters), light/dark are
   explicit overrides stored in settings. */

export type ThemeSetting = "auto" | "light" | "dark";

let systemListener: ((e: MediaQueryListEvent) => void) | null = null;
const mql =
  typeof matchMedia === "undefined"
    ? null
    : matchMedia("(prefers-color-scheme: dark)");

function apply(theme: ThemeSetting) {
  const dark =
    theme === "dark" || (theme === "auto" && (mql?.matches ?? false));
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = theme;
}

export function applyTheme(theme: string) {
  const setting: ThemeSetting =
    theme === "light" || theme === "dark" ? theme : "auto";
  apply(setting);
  if (systemListener) {
    mql?.removeEventListener("change", systemListener);
    systemListener = null;
  }
  if (setting === "auto" && mql) {
    systemListener = () => apply("auto");
    mql.addEventListener("change", systemListener);
  }
}
