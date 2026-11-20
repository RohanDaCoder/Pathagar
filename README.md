# Pathagar

**A lightweight cross-platform app for reading Class 9-10 guide books — Android and Web (Netlify) from a single codebase.**

The original "Class 9 All Subject Books" (`com.nahidnafiz.classninebooks`) app was
reverse-engineered with apkscope to understand its data pipeline; this client was
then written from scratch on top of it — no ads, small footprint, an English UI,
a fully offline library, and a tag-based release system.

| | |
|---|---|
| Repository | `RohanDaCoder/Pathagar` — the in-app updater looks for new versions in its Releases |
| App ID | `com.pathagar.app` |
| Web shell | ~280 KB (pdf.js 1.4 MB loads lazily, only while reading) · APK ~3.5 MB |
| Data | 4 branches · 73 books · 1,247 chapters (SSC 2028, Madrasah, English Version, old set) |
| Storage | IndexedDB — downloaded chapters read without internet |

---

## Architecture (modular, no build step)

```
pathagar/
├── www/                          ← the app (this is the website AND the Android app)
│   ├── index.html                ← empty shell (CSP, meta, bottom nav)
│   ├── css/app.css               ← full stylesheet
│   ├── js/
│   │   ├── main.js               ← composition root: router + view dispatch + SW registration
│   │   ├── config.js             ← platform detection, settings, global state (S)
│   │   ├── utils.js              ← DOM helpers, number formatting, toasts, SVG icons
│   │   ├── db.js                 ← IndexedDB (files + meta stores)
│   │   ├── net.js                ← network adapter (fetch / CapacitorHttp range-chunks)
│   │   ├── catalog.js            ← API + localStorage cache + bundled snapshot
│   │   ├── dlqueue.js            ← download manager (queue, concurrency, progress, cancel)
│   │   ├── router.js             ← hash router
│   │   ├── updater.js            ← GitHub Releases update check + semver comparison
│   │   ├── reader.js             ← pdf.js viewer
│   │   └── views/                ← home · branch · book · library · settings
│   ├── vendor/                   ← pdf.js 3.11 (lazy), @capacitor/core
│   ├── manifest.webmanifest · sw.js · _redirects
│   └── catalog-snapshot.json     ← offline catalog (4 branches, 73 books)
├── android/                      ← Capacitor 6 project (com.pathagar.app)
├── .github/
│   ├── workflows/ci.yml          ← PR/push: JS syntax + sw precache checks + debug APK
│   ├── workflows/release.yml     ← tag v* → signed APK + web zip → GitHub Release
│   └── workflows/netlify.yml     ← (optional) main push → Netlify deploy
└── netlify.toml · capacitor.config.json · package.json
```

**Dependency direction:** `main.js → views → {catalog, dlqueue, reader, utils}
→ {net, db} → config`. No cycles — the download queue knows nothing about the UI;
it plugs in through the `DL.onRowUpdate` / `DL.openChapter` callback injections.
To add a view: a file in `js/views/` + one line in `main.js` + (for JS files) one
line in the `sw.js` precache list — CI catches it if you forget.

## How it works (from the reverse-engineering session)

```
branches → books    GET  ────────►  books.tetashweb.xyz/api/v1/app/
chapter list        GET  ────────►    /categories?key=…&parent=<id>&limit=200
PDF download        GET  ────────►    /books?key=…&category=<id>&limit=300&page=N
                                    ↳ each chapter's JSON carries a direct pdf url
                                    pdf.tetashweb.xyz/pdfr2files/files/… (no key, Range support)
```

- **API host** has open CORS → the browser fetches data directly.
- **PDF host** sends no CORS → on web, Netlify's `/pdf/*` reverse proxy (`_redirects`
  + `netlify.toml`); on Android, `CapacitorHttp` (native HTTP, 1 MB range-chunks for
  accurate progress).
- **Storage:** IndexedDB on both platforms (`pathagar` DB, `ptg:` localStorage prefix).
- **Updater:** on launch, checks `api.github.com/repos/RohanDaCoder/Pathagar/releases/latest`
  (`updater.js`), semver-compares, shows a banner on Home linking the APK download.
  On web, the SW (`ptg-v<version>` cache) hot-updates automatically.

## Development workflow (PR-based)

We follow PR-based development: the **orchestrator** reviews and merges, the
**developer** works on branches and sends PRs.

```bash
# 1. create a branch
git switch -c feat/<name>

# 2. test locally (same shape as Netlify: static + /pdf/* proxy)
python3 scripts/local_proxy.py 8123      # → http://127.0.0.1:8123
npm install && npx cap sync android      # re-sync when www/ changes

# 3. commit + push + PR
git add -A && git commit -m "feat: …"
git push -u origin feat/<name>
gh pr create --fill
# CI runs automatically (JS checks + debug APK artifact)
```

No direct pushes to `main` — every change goes through a PR. Fill in the PR
template checklist on each one.

## Release process (tag-based)

```bash
# 1. update APP_VERSION in www/js/config.js (e.g. '1.0.2') and merge
# 2. tag and push
git tag v1.0.2 && git push origin v1.0.2
# 3. GitHub Actions builds the signed Pathagar-v1.0.2.apk + pathagar-web-v1.0.2.zip
#    and publishes the GitHub Release automatically
```

`versionCode` is derived from the tag (major×10000 + minor×100 + patch). Once a
release is published, older installs show the update banner.

### Release signing — one-time setup (orchestrator)

The `pathagar-release-keystore/` folder (delivered to the developer's workspace)
holds the keystore and password. **Keep it private and back it up — if lost,
future updates cannot install over existing installs.** Set the repo secrets
(Settings → Secrets and variables → Actions):

```bash
gh secret set KEYSTORE_BASE64 < pathagar-release-keystore/keystore.base64
gh secret set KEYSTORE_PASSWORD < pathagar-release-keystore/PASSWORD.txt   # the raw value lives in that file
gh secret set KEY_ALIAS --body "pathagar"
gh secret set KEY_PASSWORD  < pathagar-release-keystore/PASSWORD.txt
```

(Run `gh auth login` first if needed.) Without the secrets the release workflow
will not sign — set them before pushing a tag.

## Web deploy (Netlify)

**Easiest (drag & drop):** [app.netlify.com/drop](https://app.netlify.com/drop) →
drop the `www` folder — it goes live with the `/pdf/*` proxy from `_redirects`.

**Auto-deploy (CI):** `netlify.yml` is ready; just add two secrets:
`NETLIFY_AUTH_TOKEN` (Netlify → User settings → Applications → Personal access
tokens) and `NETLIFY_SITE_ID` (Site settings → Site details → ID). After that,
every push to `main` deploys `www/` automatically.

> Tip: open the site in Android Chrome and tap **⋮ → Add to Home screen** to
> install it as a PWA.

## Android build (local)

```bash
npm install                 # first time (the android project needs node_modules/@capacitor/android)
npx cap sync android        # when www/ changes

# Debug APK
cd android && ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# Signed release (requires android/keystore.properties + release.jks)
./gradlew assembleRelease -PversionName=1.0.1 -PversionCode=10001
```

`android/keystore.properties` (gitignored) format:
`storeFile=release.jks` · `storePassword=…` · `keyAlias=pathagar` · `keyPassword=…`

## Configuration and key rotation

The app's **Settings** page lets you change the API URL, key and proxy — with a
connection test. If the API returns 403, the developer rotated the key; extract
the new one from the latest APK:

```bash
apkscope decompile <new apk> com.nahidnafiz.classninebooks.BuildConfig
```

## Legal and usage note

This client is for students' **personal study**. The guide books belong to their
publishers; the original app's developer runs the server on ad revenue. Mirroring
or redistributing the full catalog (~14 GB) is not the goal — download the books
you read, and use the original app too if you like it. The repo contains only
code and config, no PDFs.
