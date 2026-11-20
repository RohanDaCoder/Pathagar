# Pathagar

**A lightweight cross-platform app for reading Class 9-10 guide books — Android and Web from a single TypeScript codebase.**

The original "Class 9 All Subject Books" (`com.nahidnafiz.classninebooks`) app was
reverse-engineered with apkscope to understand its data pipeline; this client was
then written from scratch on top of it — no ads, small footprint, an English UI,
a fully offline library, and a tag-based release system.

|            |                                                                                       |
| ---------- | ------------------------------------------------------------------------------------- |
| Repository | `RohanDaCoder/Pathagar` — the in-app updater looks for new versions in its Releases   |
| App ID     | `me.rohandacoder.pathagar`                                                            |
| Web shell  | ~68 KB app code + 305 KB lazy pdf.js (1.1 MB worker, precached) · APK ~3.5 MB         |
| Data       | 4 branches · 73 books · 1,247 chapters (SSC 2028, Madrasah, English Version, old set) |
| Storage    | IndexedDB — downloaded chapters read without internet                                 |

## Toolchain

**bun** (1.4.6 line, pinned in CI) is the package manager, runtime, typechecker,
formatter, linter and test runner; **vite 8** builds (and serves) the web app; **TypeScript 7** with
`strict` across the board. Capacitor 8 wraps the same `dist/` build into the
Android app.

| Task        | Command                                                                 |
| ----------- | ----------------------------------------------------------------------- |
| Install     | `bun install`                                                           |
| Dev server  | `bun run dev` (with `/pdf/*` proxy)                                     |
| Type check  | `bun check` (native, all cores)                                         |
| Format      | `bun fmt` / `bun fmt --check`                                           |
| Lint        | `bun lint` (built-in, strict)                                           |
| Test        | `bun test`                                                              |
| Build       | `bun run build` → `dist/`                                               |
| Serve build | `bun run serve` (static + PDF proxy)                                    |
| Full gate   | `bun check && bun fmt --check && bun lint && bun test && bun run build` |

There is no Python anywhere in the project — the old dev proxy became the
vite dev-server proxy, and `scripts/serve.ts` (Bun) serves production builds
locally.

## Architecture

```
pathagar/
├── index.html            ← vite entry (#root mount, CSP, color-scheme meta)
├── src/                  ← React 19 + TypeScript (HashRouter, shadcn/ui, Tailwind 4)
│   ├── main.tsx          ← React mount, theme, SW registration, DL→reader bridge
│   ├── App.tsx           ← routes, bottom nav, error boundary, toasts
│   ├── config.ts         ← platform detection, settings, global state (S)
│   ├── types.ts          ← shared domain types
│   ├── catalog.ts        ← API + localStorage cache + bundled snapshot (static import)
│   ├── net.ts            ← fetch (web) / CapacitorHttp (native, 1 MiB ranged chunks)
│   ├── db.ts             ← IndexedDB (files + meta stores)
│   ├── dlqueue.ts        ← download manager (queue, concurrency, progress, cancel)
│   ├── reader/Reader.tsx ← pdf.js viewer (pdfjs-dist@6, lazy chunk)
│   ├── views/            ← Home · Branch · Book · Library · Settings
│   ├── components/ui/    ← shadcn/ui components (owned, Radix-based)
│   └── lib/ + hooks/     ← errors, format, theme, storage; queue subscription
├── public/               ← icons, _redirects (copied verbatim to dist/)
├── scripts/serve.ts      ← Bun.serve: dist + /pdf proxy for local prod preview
├── android/              ← Capacitor 8 project (webDir = dist)
└── .github/workflows/    ← ci · release · netlify · pages (+ dependabot)
```

**Dependency direction:** `main.ts → views → {catalog, dlqueue, reader, utils}
→ {net, db} → config`. No cycles — the download queue knows nothing about the
UI; it plugs in through the `DL.onRowUpdate` / `DL.openChapter` callback
injections. The service worker is **generated** by vite-plugin-pwa (precache +
API network-first), so there is no hand-maintained precache list and no
coverage check in CI. See [AGENTS.md](AGENTS.md) for the full rules.

## How it works (from the reverse-engineering session)

```
branches → books    GET  ────────►  books.tetashweb.xyz/api/v1/app/
chapter list        GET  ────────►    /categories?key=…&parent=<id>&limit=200
PDF download        GET  ────────►    /books?key=…&category=<id>&limit=300&page=N
                                    ↳ each chapter's JSON carries a direct pdf url
                                    pdf.tetashweb.xyz/pdfr2files/files/… (no key, Range support)
```

- **API host** has open CORS → the browser fetches data directly.
- **PDF host** sends no CORS → on web, the same-origin `/pdf/*` reverse proxy
  (Netlify `_redirects` in production, vite/`serve.ts` locally); on Android,
  `CapacitorHttp` (native HTTP, 1 MiB range-chunks for accurate progress).
- **Storage:** IndexedDB on both platforms (`pathagar` DB, `ptg:` localStorage prefix).
- **Updater:** on launch, checks `releases/latest`, semver-compares, shows a
  banner on Home linking the APK. On web, the service worker hot-updates.

## Development workflow (PR-based)

`main` is protected: the **orchestrator** reviews and merges, the **developer**
works on branches and sends PRs.

```bash
git switch -c feat/<name>
# …edit src/…
bun check && bun fmt --check && bun lint && bun test && bun run build  # the CI gate, locally
git add -A && git commit -m "feat: …"
git push -u origin feat/<name>
gh pr create --fill
# CI runs: bun check · fmt · lint · test · build + Android debug APK
```

## Release process (tag-based)

```bash
# 1. bump APP_VERSION in src/config.ts AND version in package.json, merge via PR
# 2. tag and push
git tag -a v1.0.2 -m "Pathagar v1.0.2 — …" && git push origin v1.0.2
# 3. Actions builds the signed Pathagar-v1.0.2.apk + pathagar-web-v1.0.2.zip
#    and publishes the GitHub Release
```

`versionCode` is derived from the tag (major×10000 + minor×100 + patch). Once a
release is published, older installs show the update banner.

### Release signing — one-time setup (orchestrator)

The `pathagar-release-keystore/` folder (delivered to the developer's workspace)
holds the keystore and password. **Keep it private and back it up — if lost,
future updates cannot install over existing installs.** Set the repo secrets:

```bash
gh secret set KEYSTORE_BASE64 < pathagar-release-keystore/keystore.base64
gh secret set KEYSTORE_PASSWORD < pathagar-release-keystore/PASSWORD.txt
gh secret set KEY_ALIAS --body "pathagar"
gh secret set KEY_PASSWORD  < pathagar-release-keystore/PASSWORD.txt
```

## Web deploys

**Netlify (primary home):** the site is linked to this repository through
Netlify's GitHub integration — every push to `main` builds and publishes
production, and every PR gets a **deploy preview** URL
(`deploy-preview-<n>--pathagarz.netlify.app`). The build command in
`netlify.toml` runs the same `bun check` / `bun test` gate CI runs, so a red
check can never ship. Production deploys are git-only
(`prevent_non_git_prod_deploys`), which is why there is no deploy step in
GitHub Actions: the CLI-upload workflow shipped earlier could never deploy
and was removed. Netlify matters because its `/pdf/*` proxy is what makes
chapter downloads work in browsers. Manual alternative: `bun run build` and
drag `dist/` to [app.netlify.com/drop](https://app.netlify.com/drop).
The `NETLIFY_AUTH_TOKEN` / `NETLIFY_SITE_ID` repo secrets are kept for
`netlify` CLI operations against the site.

**GitHub Pages (demo mirror):** the `pages.yml` workflow publishes the app to
`https://<user>.github.io/Pathagar/` (built with `VITE_BASE=/Pathagar/`).
Pages cannot reverse-proxy `/pdf/*`, so chapter **downloads don't work there** —
the app detects the host and shows a banner; browsing and offline reading work.

## Android build (local)

```bash
bun install                 # first time (the android project needs @capacitor/android)
bun run build && bun run cap:sync   # when src/ changes
bun run build:apk           # debug APK → android/app/build/outputs/apk/debug/

# Signed release (requires android/keystore.properties + release.jks)
cd android && ./gradlew assembleRelease -PversionName=1.1.0 -PversionCode=10100
```

`android/keystore.properties` (gitignored) format:
`storeFile=release.jks` · `storePassword=…` · `keyAlias=pathagar` · `keyPassword=…`

## Configuration and key rotation

The app's **Settings** page lets you change the API URL, key and proxy — with a
connection test. If the API returns 403, the upstream developer rotated the key;
extract the new one from the latest APK:

```bash
apkscope decompile <new apk> com.nahidnafiz.classninebooks.BuildConfig
```

## Legal and usage note

This client is for students' **personal study**. The guide books belong to their
publishers; the original app's developer runs the server on ad revenue.
Mirroring or redistributing the full catalog (~14 GB) is not the goal —
download the books you read, and use the original app too if you like it. The
repo contains only code and config, no PDFs.
