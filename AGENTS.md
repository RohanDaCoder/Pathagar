# AGENTS.md

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Pathagar — a lightweight, installable **PWA** (pure web; the native/Capacitor
shell and APK pipeline were removed in v1.4) for reading Class 9-10 (SSC) guide
books. The catalog and PDFs come from the original "Class 9 All Subject Books"
app's server (reverse-engineered). This repo contains code and config only —
never PDFs or other copyrighted content; the project is for students' personal
study.

- App ID: `me.rohandacoder.pathagar` · Repository: `RohanDaCoder/Pathagar`
- Production: https://pathagarz.netlify.app (auto-deploys from `main`)

## Toolchain (bun-first)

| Concern                   | Tool                                                                                                                                           | Command                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Package manager / runtime | bun (pinned in CI to the 1.4.6 canary line — it ships the built-in linter; locally `bun upgrade --canary` if `check`/`fmt`/`lint` are missing) | `bun install`                           |
| Type check                | bun's native checker (same errors as tsc)                                                                                                      | `bun check`                             |
| Format                    | bun's built-in formatter                                                                                                                       | `bun fmt` / `bun fmt --check`           |
| Lint                      | bun built-in linter (strict, bunfig.toml)                                                                                                      | `bun lint` / `bun lint --fix`           |
| Unit tests                | bun test                                                                                                                                       | `bun test`                              |
| Dev server                | vite 8 (proxies `/pdf/*` to the PDF host)                                                                                                      | `bun run dev` → http://127.0.0.1:5173   |
| Build                     | vite 8 → `dist/`                                                                                                                               | `bun run build`                         |
| Serve the build           | Bun static server + PDF proxy                                                                                                                  | `bun run serve` → http://127.0.0.1:4173 |

Run the full local gate before pushing — this is exactly what CI runs:

```bash
bun check && bun fmt --check && bun lint && bun test && bun run build
```

`bun fmt` also formats YAML/JSON/Markdown (workflows, this file, the catalog
snapshot) and must run before every commit — CI has an `fmt --check` gate.

## Project layout

```
├── index.html              vite entry (#root mount, CSP, no page zoom)
├── src/
│   ├── main.tsx            composition root: mount, theme, SW, DL→reader bridge
│   ├── App.tsx             routes, bottom nav, error boundary
│   ├── config.ts           porting constants (API/key/proxy) + settings
│   ├── types.ts            domain types (Branch, Book, Chapter, DlState…)
│   ├── catalog.ts          CatalogService → `catalog()` + `initCatalog()`
│   │                       (API → cache → snapshot chunk)
│   ├── net.ts              ApiClient → `api` + streamed PDF download w/ progress
│   ├── db.ts               ChapterStore → `DB` (IndexedDB files + meta)
│   ├── downloads/          DownloadQueue → `DL` (queue, concurrency, speed)
│   ├── lib/
│   │   ├── titles/         chapter-title parser module (see Architecture)
│   │   ├── branches.ts     SSOT: branch ids, labels, hidden flag
│   │   ├── nameFixes.ts    SSOT: upload-side book-name fixes
│   │   └── format/errors/theme/storage
│   ├── reader/             Reader.tsx (layout/state) · pdfEngine.ts · usePinchSurface.ts
│   ├── views/              Home · Branch (+branch/BookCard) · Pick · Book
│   │                       (+book/rows) · Library · Settings
│   ├── hooks/              useAsyncData · useDlVersion · useInstallPrompt
│   ├── components/         app components + ui/ (shadcn, owned code)
│   └── styles.css          Tailwind 4 entry + theme vars + Bengali fonts
├── scripts/make-snapshot.ts  regenerates src/catalog-snapshot.json from the API
│                             (reads lib/branches.ts + lib/nameFixes.ts)
├── public/                 copied verbatim to dist/ (icons, _redirects)
├── vite.config.ts          react + tailwind plugins, dev proxy, PWA
├── bunfig.toml             lint configuration (strict + exceptions)
└── .github/workflows/      ci · netlify
```

## Architecture rules

- **Dependency direction:** React layer (`main → App → views/reader`) →
  services (`catalog`, `downloads`, `db`, `net`) → `lib` → `config`. No cycles.
- **Code splitting:** every route view is a `React.lazy` chunk behind one
  Suspense boundary in App.tsx; the ~250 KB catalog snapshot is its own lazy
  chunk loaded by `initCatalog()` — `main.tsx` awaits it before the first
  render (all views read `catalog()` synchronously, so it must be ready; the
  bootstrap retries once, then shows a fatal screen). pdf.js was already lazy
  (`pdfEngine.ensurePdfJs`). Keep heavy imports behind dynamic `import()`.
  The service worker precaches every emitted chunk, so offline first-load
  still works after the first visit.
- **One source of truth** (the DRY rule, enforced structurally):
  - branch labels and which branches ship → `lib/branches.ts`
    (`make-snapshot.ts` reads it; the Home grid renders the snapshot)
  - book-name fixes → `lib/nameFixes.ts` (applied by `CatalogService` on every
    data path AND by `make-snapshot.ts`)
  - catalog access → `CatalogService` only; views never walk the snapshot
  - download state → `DownloadQueue` only; views read `DL.stateOf/entries/stats`
- **Classes own lifecycles:** `CatalogService`, `DownloadQueue`,
  `ChapterStore`, `ApiClient`, `PdfEngine`. Parsers stay functional
  (`lib/titles/`).
- **lib/titles/ module map:** `bengali` (digits, য় normalization) · `ordinals`
  · `chapterTitle` (parses the API's ~12 ad-hoc upload formats into
  `{number, label, display, pages, kind}`; noise like "(1)" / underscores /
  " - এসএসসি …" suffixes is stripped) · `bookName` (strips guide/MCQ/SSC
  decorations; `isTwin` pairs the MCQ/CQ uploads of one subject) · `streams`
  (SSC stream grouping) · `mathNames` (official NCTB names for the nameless
  গণিত গাইড chapters) · `ordering`. Public API: `lib/titles/index.ts`;
  tests import from `@/lib/titles`.
- **The download queue lives outside React** (downloads continue while
  navigating); views subscribe via `useDlVersion` (useSyncExternalStore).
- **The catalog snapshot** is a static JSON import riding inside the bundle —
  the offline last resort. Hidden branches (`hidden: true` in branches.ts)
  never ship.
- **PDFs** go through the same-origin `/pdf/*` reverse proxy (the PDF host
  sends no CORS headers): vite dev proxy locally, Netlify `_redirects` in
  production. The edge serves them brotli-compressed so `content-length` lies;
  progress uses a 1-byte Range probe for the true total.
- **Page zoom is disabled** (`user-scalable=no`); the reader is an isolated
  pan/zoom surface (`usePinchSurface`) — only the canvas moves during a pinch,
  the chrome stays put, and the crisp pdf.js re-render commits on release.
- **The service worker** is generated by vite-plugin-pwa at build time; do not
  hand-maintain a precache list.

## Conventions

- TypeScript strict; `bun check` must pass with zero errors. Real types over
  `any`; type assertions only at data boundaries, with a comment.
- Comments: 1–3-line file headers and why-comments — no comment essays; this
  file carries the extended context instead.
- Bengali literals in code: build য় from `\u09df` escapes — hand-typed য় is
  Unicode-form unreliable (decomposed vs precomposed shipped bugs twice).
  Verify with `codePointAt` when in doubt.
- Chapter numbers render in **English numerals** (`bnNum` at render points).
- `eslint-disable` comments are allowed only with a stated reason.

## Workflows

- **CI** (PR + push main): `bun check` · `bun fmt --check` · `bun lint` ·
  `bun test` · `bun run build` (+ dist artifact). Least-privilege permissions,
  SHA-pinned actions, Dependabot.
- **Netlify** (push main): deploys `dist/`. If the `NETLIFY_AUTH_TOKEN` /
  `NETLIFY_SITE_ID` secrets are missing the deploy job shows as **skipped**
  (gray) — never green without deploying.
- **Release:** keep `APP_VERSION` (src/config.ts) and `version`
  (package.json) equal, merge via PR, then
  `git tag -a vX.Y.Z -m "Pathagar vX.Y.Z — <one line>" && git push origin vX.Y.Z`
  and publish the GitHub release with `pathagar-src-vX.Y.Z.zip`
  (`git archive --format=zip -o … vX.Y.Z`). No APKs, no in-app updater.

## Gotchas

- **API key rotation:** if the guide API returns 403, the upstream app rotated
  its key. Extract the new one from the latest original APK
  (`apkscope decompile <apk> com.nahidnafiz.classninebooks.BuildConfig`) and
  update `API_KEY` in `src/config.ts`.
- **pdfjs-dist is pinned to 6.5.438 exactly** — major versions change the
  worker and API surface. Upgrade deliberately, not via `bun update`.
- **Regenerating the snapshot** (`bun scripts/make-snapshot.ts`) walks the live
  API and re-bakes every parsed chapter list — run `bun fmt` after, and expect
  a large diff.
- **bun lint is strict** (correctness + suspicious + perf as errors; see
  bunfig.toml for the rationale and the few exceptions). Fixes go in code, not
  rule-offs.

## Personal-use scope

Do not add copyrighted material (PDFs, book text) to the repo, do not mirror
or redistribute the catalog, and keep attribution to the original app and
publishers in the About section.
