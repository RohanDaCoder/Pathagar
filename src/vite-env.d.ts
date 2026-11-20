/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/* Web Install API (modern-web-guidance install-web-app) — not in lib.dom yet */
interface Navigator {
  install(options?: { manifest?: string; manifestId?: string }): Promise<void>;
}
