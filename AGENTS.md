# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Pathagar is a lightweight client for reading Class 9-10 (SSC) guide books —
one TypeScript codebase that ships as an installable PWA (web) and an Android
app (Capacitor wraps the same vite build). The catalog and PDFs come from the
original "Class 9 All Subject Books" app's server (reverse-engineered);
this repo contains code and config only — never PDFs or other copyrighted
content, and the project is for students' personal study.

- App ID: `com.pathagar.app` · Repository: `RohanDaCoder/Pathagar`
- The in-app updater reads `releases/latest` from this repo and links the APK.

## Toolchain (bun-first)

| Concern                   | Tool                                      | Command                                 |
| ------------------------- | ----------------------------------------- | --------------------------------------- |
| Package manager / runtime | bun 1.4.5 (pinned in CI)                  | `bun install`, `bunx …`                 |
| Type check                | bun's native checker (same errors as tsc) | `bun check`                             |
| Format                    | bun's built-in formatter (Prettier-like)  | `bun fmt` / `bun fmt --check`           |
| Lint                      | Biome (bun has no built-in lint)          | `bun run lint` / `bun run lint:fix`     |
| Unit tests                | bun test                                  | `bun test`                              |
| Dev server                | vite 8 (proxies `/pdf/*` to the PDF host) | `bun run dev` → http://127.0.0.1:5173   |
| Build                     | vite 8 → `dist/`                          | `bun run build`                         |
| Serve the build           | Bun static server + PDF proxy             | `bun run serve` → http://127.0.0.1:4173 |
| Android sync/build        | Capacitor 6                               | `bun run cap:sync`, `bun run build:apk` |

`typescript@7` is a devDependency for editor tooling (tsserver) and a
cross-check (`bunx tsc --noEmit`); CI uses `bun check` because it is faster.

Run the full local gate before pushing — this is exactly what CI runs:

```bash
bun check && bun fmt --check && bun run lint && bun test && bun run build
```

## Project layout

```
├── index.html            vite entry (app shell, CSP, bottom nav)
├── src/                  TypeScript sources (no framework, hash-routed)
│   ├── main.ts           composition root: router + view dispatch + SW registration
│   ├── config.ts         platform detection, settings, global state (S)
│   ├── types.ts          shared domain types (Branch, Book, Chapter, DlState…)
│   ├── catalog.ts        API + localStorage cache + bundled snapshot (static JSON import)
│   ├── net.ts            network adapter: fetch (web) / CapacitorHttp (native, ranged)
│   ├── db.ts             IndexedDB (files + meta stores)
│   ├── dlqueue.ts        download manager (queue, concurrency, progress, cancel)
│   ├── reader.ts         pdf.js viewer (npm pdfjs-dist@3.11, lazy chunk + worker URL)
│   ├── updater.ts        GitHub Releases check + semver compare
│   ├── app.css           full stylesheet (fonts in src/assets/fonts)
│   ├── *.test.ts         bun tests (pure logic only)
│   └── views/            home · branch · book · library · settings
├── public/               copied verbatim to dist/ (icons, _redirects)
├── scripts/serve.ts      Bun.serve: dist + /pdf proxy (local prod preview)
├── android/              Capacitor 6 project (webDir = dist)
├── vite.config.ts        dev proxy, PWA (vite-plugin-pwa), VITE_BASE for Pages
├── biome.json            lint only (formatter is OFF — `bun fmt` owns formatting)
└── .github/workflows/    ci · release · netlify · pages
```

## Architecture rules

- **Dependency direction:** `main.ts → views → {catalog, dlqueue, reader, utils}
→ {net, db} → config`. No cycles. The download queue never imports the UI;
  views inject behavior via `DL.onRowUpdate` / `DL.openChapter`.
- **The service worker is generated** by vite-plugin-pwa (workbox) at build
  time — do not hand-maintain a precache list; there is no coverage check in
  CI anymore. Runtime caching for the guide API (network-first) is configured
  in `vite.config.ts`.
- **The catalog snapshot** (`src/catalog-snapshot.json`) is a static import —
  it rides inside the JS bundle, works on any host/base path (including
  GitHub Pages), and is the offline last-resort for branch/book lists.
- **PDF downloads on web** go through the same-origin `/pdf/*` reverse proxy
  (the PDF host sends no CORS headers). Locally that proxy is the vite dev
  server or `scripts/serve.ts`; in production it is Netlify's `_redirects`.
  GitHub Pages cannot proxy — the Pages deploy is a demo and the app shows a
  banner saying so.
- **Numbers in the UI** go through `bn()` in `utils.ts` (historically Bengali
  digits; now a pass-through). Keep using it so localization stays one-point.
- TypeScript is strict; `bun check` must pass with zero errors. Prefer real
  types over `any`; `requireEl()` replaces non-null assertions for shell elements.

## Workflows (all bun-based, all cached)

- **CI** (PR + push main): `bun check` · `bun fmt --check` · `bun run lint` ·
  `bun test` · `bun run build` (+ dist artifact), and an Android debug APK job
  (gradle cache via `actions/cache`; bun cache via `setup-bun`).
- **Release** (tag `vX.Y.Z`): builds web + signed APK (keystore from repo
  secrets), publishes the GitHub Release. `versionCode` = major·10000 +
  minor·100 + patch. Tag titles are English.
- **Netlify** (push main): deploys `dist/` via the official
  `netlify/actions/cli@master`. If the `NETLIFY_AUTH_TOKEN` / `NETLIFY_SITE_ID`
  secrets are missing, the deploy job shows as **skipped** (gray) — never green
  without deploying.
- **Pages** (push main): builds with `VITE_BASE=/Pathagar/` and publishes to
  GitHub Pages. Demo only (no PDF proxy there).

## Release checklist

1. Bump `APP_VERSION` in `src/config.ts` AND `version` in `package.json` (keep
   them equal), merge via PR.
2. `git tag -a vX.Y.Z -m "Pathagar vX.Y.Z — <one line>" && git push origin vX.Y.Z`
3. The Release workflow publishes `Pathagar-vX.Y.Z.apk` + `pathagar-web-vX.Y.Z.zip`.
4. Older installs see the update banner (updater checks `releases/latest`).

## Gotchas

- **API key rotation:** if the guide API starts returning 403, the upstream
  app rotated its key. Extract the new one from the latest APK
  (`apkscope decompile <apk> com.nahidnafiz.classninebooks.BuildConfig`) and
  update `DEFAULT_SETTINGS` in `src/config.ts`; users can also paste a new key
  in Settings at runtime.
- **pdfjs-dist is pinned to 3.11.174 exactly** — 4.x/6.x changed the worker and
  API surface. Upgrade deliberately, not via `bun update`.
- **Capacitor stays on 6.x** — the `android/` project was generated for it.
  A major upgrade needs `cap migrate` and a full device test.
- **`bun fmt` formats YAML/JSON/Markdown too** (including workflows and this
  file). Run it before pushing; CI checks it.
- **Signing:** the keystore lives in repo secrets, derived from the private
  `pathagar-release-keystore/` folder. Losing it means future updates can't
  install over existing installs — keep it backed up.

## Personal-use scope

Do not add copyrighted material (PDFs, book text) to the repo, do not mirror
or redistribute the catalog, and keep attribution to the original app and
publishers in the About section.
