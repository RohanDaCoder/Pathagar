# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Pathagar is a lightweight client for reading Class 9-10 (SSC) guide books —
one TypeScript codebase that ships as an installable PWA. The catalog and PDFs come from the
original "Class 9 All Subject Books" app's server (reverse-engineered);
this repo contains code and config only — never PDFs or other copyrighted
content, and the project is for students' personal study.

- App ID: `me.rohandacoder.pathagar` · Repository: `RohanDaCoder/Pathagar`
- npm package name: `me.rohandacoder.pathagar`
- The in-app updater reads `releases/latest` from this repo and links the APK.

## Toolchain (bun-first)

| Concern                   | Tool                                      | Command                                 |
| ------------------------- | ----------------------------------------- | --------------------------------------- |
| Package manager / runtime | bun 1.4.5 (pinned in CI)                  | `bun install`, `bunx …`                 |
| Type check                | bun's native checker (same errors as tsc) | `bun check`                             |
| Format                    | bun's built-in formatter (Prettier-like)  | `bun fmt` / `bun fmt --check`           |
| Lint                      | bun built-in linter (strict, bunfig.toml) | `bun lint` / `bun lint --fix`           |
| Unit tests                | bun test                                  | `bun test`                              |
| Dev server                | vite 8 (proxies `/pdf/*` to the PDF host) | `bun run dev` → http://127.0.0.1:5173   |
| Build                     | vite 8 → `dist/`                          | `bun run build`                         |
| Serve the build           | Bun static server + PDF proxy             | `bun run serve` → http://127.0.0.1:4173 |

`typescript@7` is a devDependency for editor tooling (tsserver) and a
cross-check (`bunx tsc --noEmit`); CI uses `bun check` because it is faster.
The `bun` version is pinned in CI to the **1.4.6 line (canary)** — that is the
release that ships the built-in linter; move the pin to `1.4.6` stable once it
lands on npm.

Run the full local gate before pushing — this is exactly what CI runs:

```bash
bun check && bun fmt --check && bun lint && bun test && bun run build
```

## Project layout

```
├── skills/               vendored agent skills (github-actions-*, shadcn-ui,
│                         react-best-practices, web-design-guidelines, find-skills)
├── index.html            vite entry (#root mount, CSP, color-scheme)
├── src/                  React 19 + TypeScript (HashRouter, shadcn/ui, Tailwind 4)
│   ├── main.tsx          React mount, theme, SW registration, DL→reader bridge
│   ├── App.tsx           routes, bottom nav, error boundary, Toaster (sonner)
│   ├── config.ts         platform detection, settings, global state (S)
│   ├── types.ts          shared domain types (Branch, Book, Chapter, DlState…)
│   ├── catalog.ts        API + localStorage cache + bundled snapshot (static JSON import)
│   ├── net.ts            network adapter: fetch (web) / CapacitorHttp (native, ranged)
│   ├── db.ts             IndexedDB (files + meta stores)
│   ├── dlqueue.ts        download manager (queue, concurrency, progress, cancel)
│   ├── updater.ts        GitHub Releases check + semver compare
│   ├── reader/Reader.tsx pdf.js viewer (npm pdfjs-dist@6, lazy chunk + worker URL)
│   ├── views/            Home · Branch · Book · Library · Settings (React)
│   ├── components/ui/    shadcn/ui components (owned code, not node_modules)
│   ├── components/       app components (ErrorState…)
│   ├── hooks/            useDlVersion (queue → useSyncExternalStore)
│   ├── lib/              errors, format, theme, storage (framework-agnostic)
│   ├── styles.css        Tailwind 4 entry + theme vars + Bengali fonts
│   └── *.test.ts         bun tests (pure logic only)
├── public/               copied verbatim to dist/ (icons, _redirects)
├── scripts/serve.ts      Bun.serve: dist + /pdf proxy (local prod preview)
├── android/              Capacitor 8 project (webDir = dist, Java 21)
├── vite.config.ts        react + tailwind plugins, dev proxy, PWA, VITE_BASE
├── bunfig.toml           lint configuration (strict categories + exceptions)
└── .github/workflows/    ci · release · netlify · pages (+ dependabot.yml)
```

## Architecture rules

- **Dependency direction:** React layer (`main.tsx → App → views/reader →
{catalog, dlqueue, hooks, components}`) → framework-agnostic core
  (`{net, db, updater, lib} → config`). No cycles. The download queue lives
  outside React (downloads continue while navigating); views subscribe through
  `hooks/useDlVersion` (useSyncExternalStore) and the queue calls back via
  `DL.onRowUpdate` / `DL.openChapter`.
- **Framework choice:** React 19 + react-router (HashRouter — works on static
  hosts and Capacitor without server rewrites) + Tailwind 4 + shadcn/ui
  (Radix primitives, copied into `src/components/ui/` — they are owned code;
  edit them freely). The vercel-react-best-practices skill in `skills/`
  documents the performance patterns (no waterfalls, direct imports over
  barrels, `void` on fire-and-forget promises).
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

- **CI** (PR + push main): `bun check` · `bun fmt --check` · `bun lint` ·
  `bun test` · `bun run build` (+ dist artifact), and an Android debug APK job.
  All jobs: least-privilege `permissions`, SHA-pinned actions (Dependabot bumps
  them weekly via `.github/dependabot.yml`), `persist-credentials: false`,
  timeouts, concurrency cancellation, and caches (bun installs + gradle).
- **Release** (tag `vX.Y.Z`): builds the signed APK (keystore from repo
  secrets) and publishes the GitHub Release — APK only; the web bundle is
  deployed by the Netlify/Pages workflows on main, so no zip is attached.
  `versionCode` = major·10000 + minor·100 + patch. Tag titles are English.
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
- **pdfjs-dist is pinned to 6.5.438 exactly** — major versions change the worker
  and API surface (`canvas` render param, loading-task `destroy()`). Upgrade
  deliberately, not via `bun update`.
- **Capacitor is on 8.x** (Java 21 bytecode, SDK 36) — the `android/` project
  matches the 8.6.2 template. A major upgrade needs the template diff + a full
  device test.
- **`bun fmt` formats YAML/JSON/Markdown too** (including workflows, this
  file and the vendored `skills/`). Run it before pushing; CI checks it.
- **`bun lint` is strict** (correctness + suspicious + perf as errors — see
  `bunfig.toml` for the rationale and the two rule exceptions). Fixes go in
  code, not in rule-offs.
- **Signing:** the keystore lives in repo secrets, derived from the private
  `pathagar-release-keystore/` folder. Losing it means future updates can't
  install over existing installs — keep it backed up.

## Personal-use scope

Do not add copyrighted material (PDFs, book text) to the repo, do not mirror
or redistribute the catalog, and keep attribution to the original app and
publishers in the About section.
