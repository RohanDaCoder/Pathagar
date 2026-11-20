/* vite.config.ts — build/dev config
   - dev server proxies /pdf/* to the guide PDF host (same shape as the
     Netlify /pdf/* production proxy)
   - vite-plugin-pwa generates the service worker (precache + API network-first) */
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { VitePWA } from "vite-plugin-pwa";

const PDF_UPSTREAM = "https://pdf.tetashweb.xyz";
const API_ORIGIN = "https://books.tetashweb.xyz";
const base = "/";

const pdfProxy = {
  target: PDF_UPSTREAM,
  changeOrigin: true,
  rewrite: (p: string) => p.replace(/^\/pdf/, ""),
};

/* index.html tweaks: allow the HMR websocket through the CSP in dev; in build,
   prefix icon hrefs with the deployment base (public/ assets are not rebased by vite) */
function pathagarHtml(assetBase: string): Plugin {
  return {
    name: "pathagar-html",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (ctx.server) return html.replace("connect-src ", "connect-src ws: ");
        return html.replaceAll('href="icons/', `href="${assetBase}icons/`);
      },
    },
  };
}

export default defineConfig({
  base,
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/pdf": pdfProxy },
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    proxy: { "/pdf": pdfProxy },
  },
  plugins: [
    react(),
    tailwindcss(),
    pathagarHtml(base),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null, // registered manually in src/main.ts (skipped inside Capacitor)
      includeAssets: ["icons/favicon.png", "icons/apple-touch-icon.png"],
      manifest: {
        id: base, // stable app identity for installs (see install-web-app guide)
        name: "Pathagar — Class 9-10 Guide",
        short_name: "Pathagar",
        description:
          "Download Class 9-10 guide book chapters and read them offline.",
        lang: "en",
        dir: "ltr",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#0D6E62",
        theme_color: "#0D6E62",
        icons: [
          {
            src: `${base}icons/icon-192.png`,
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: `${base}icons/icon-512.png`,
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,mjs,css,html,woff2,png,webmanifest}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
        runtimeCaching: [
          {
            /* guide API: network-first with cache fallback (offline catalogs) */
            urlPattern: ({ url }: { url: URL }) => url.origin === API_ORIGIN,
            handler: "NetworkFirst",
            options: {
              cacheName: "ptg-api-v1",
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
});
