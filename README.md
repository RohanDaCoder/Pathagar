# পাঠাগার (Pathagar)

**ক্লাস ৯-১০ এর গাইড বই পড়ার হালকা ক্রস-প্ল্যাটফর্ম অ্যাপ — Android ও ওয়েব (Netlify) একই কোড থেকে।**

মূল "Class 9 All Subject Books" (`com.nahidnafiz.classninebooks`) অ্যাপটি apkscope দিয়ে
reverse-engineer করে তার ডেটা-পাইপলাইন বের করা হয়েছে, এবং সেই ওপর ভিত্তি করে এই ক্লায়েন্ট
নতুন করে লেখা — বিজ্ঞাপন ছাড়া, হালকা, বাংলা ইউআই, সম্পূর্ণ অফলাইন লাইব্রেরি, আর ট্যাগ-ভিত্তিক
রিলিজ সিস্টেম।

| | |
|---|---|
| রিপো | `RohanDaCoder/Pathagar` — এই রিলিজ থেকেই ইন-অ্যাপ আপডেটার নতুন ভার্সন খোঁজে |
| অ্যাপ আইডি | `com.pathagar.app` |
| ওয়েব শেল | ~২৮০ KB (pdf.js 1.4 MB শুধু পড়ার সময় লোড হয়) · APK ~৩.৫ MB |
| ডেটা | ৪টি শাখা · ৭৩টি বই · ১,২৪৭টি অধ্যায় (SSC 2028, মাদ্রাসা, English Version, পুরাতন সেট) |
| স্টোরেজ | IndexedDB — ডাউনলোড করা অধ্যায় ইন্টারনেট ছাড়াই পড়া যায় |

---

## স্থাপত্য (modular, no build step)

```
pathagar/
├── www/                          ← অ্যাপ (এটাই ওয়েব সাইট, এটাই Android অ্যাপ)
│   ├── index.html                ← খালি শেল (CSP, meta, bottom nav)
│   ├── css/app.css               ← সম্পূর্ণ স্টাইলশিট
│   ├── js/
│   │   ├── main.js               ← composition root: রাউটার + ভিউ ডিসপ্যাচার + SW রেজিস্ট্রেশন
│   │   ├── config.js             ← প্ল্যাটফর্ম ডিটেকশন, সেটিংস, গ্লোবাল স্টেট (S)
│   │   ├── utils.js              ← DOM হেল্পার, বাংলা সংখ্যা, toast, SVG আইকন
│   │   ├── db.js                 ← IndexedDB (files + meta stores)
│   │   ├── net.js                ← নেটওয়ার্ক অ্যাডাপ্টার (fetch / CapacitorHttp রেঞ্জ-চাংক)
│   │   ├── catalog.js            ← API + localStorage ক্যাশ + bundled স্ন্যাপশট
│   │   ├── dlqueue.js            ← ডাউনলোড ম্যানেজার (queue, concurrency, progress, cancel)
│   │   ├── router.js             ← হ্যাশ রাউটার
│   │   ├── updater.js            ← GitHub Releases আপডেট চেক + semver তুলনা
│   │   ├── reader.js             ← pdf.js ভিউয়ার
│   │   └── views/                ← home · branch · book · library · settings
│   ├── vendor/                   ← pdf.js 3.11 (লেজি), @capacitor/core
│   ├── manifest.webmanifest · sw.js · _redirects
│   └── catalog-snapshot.json     ← অফলাইন ক্যাটালগ (৪ শাখা, ৭৩ বই)
├── android/                      ← Capacitor 6 প্রজেক্ট (com.pathagar.app)
├── .github/
│   ├── workflows/ci.yml          ← PR/push: JS সিনট্যাক্স + sw প্রিক্যাশ যাচাই + debug APK
│   ├── workflows/release.yml     ← tag v* → সাইনড APK + web zip → GitHub Release
│   └── workflows/netlify.yml     ← (ঐচ্ছিক) main push → Netlify ডিপ্লয়
└── netlify.toml · capacitor.config.json · package.json
```

**নির্ভরতার দিক (dependency direction):** `main.js → views → {catalog, dlqueue, reader, utils}
→ {net, db} → config`। সাইকেল নেই — ডাউনলোড কিউ UI-কে জানে না; `DL.onRowUpdate` /
`DL.openChapter` কলব্যাক ইনজেকশন দিয়ে যুক্ত। নতুন ভিউ যোগ করতে: `js/views/`-এ ফাইল +
`main.js`-এ এক লাইন + (js হলে) `sw.js` প্রিক্যাশ তালিকায় এক লাইন — CI ভুলে গেলে ধরে ফেলবে।

## কীভাবে কাজ করে (RE থেকে যা জানা গেছে)

```
শাখা → বই তালিকা    GET  ────────►  books.tetashweb.xyz/api/v1/app/
অধ্যায় তালিকা       GET  ────────►    /categories?key=…&parent=<id>&limit=200
PDF ডাউনলোড         GET  ────────►    /books?key=…&category=<id>&limit=300&page=N
                                    ↳ প্রতিটি অধ্যায়ের JSON-এ সরাসরি pdf URL থাকে
                                    pdf.tetashweb.xyz/pdfr2files/files/… (কী লাগে না, Range সাপোর্ট)
```

- **API হোস্ট** CORS খোলা → ব্রাউজার সরাসরি ডেটা আনে।
- **PDF হোস্ট** CORS দেয় না → ওয়েবে Netlify `/pdf/*` রিভার্স প্রক্সি (`_redirects` +
  `netlify.toml`), Android-এ `CapacitorHttp` (নেটিভ HTTP, 1 MB রেঞ্জ-চাংকে সঠিক প্রোগ্রেস)।
- **স্টোরেজ:** দুই প্ল্যাটফর্মেই IndexedDB (`pathagar` DB, `ptg:` localStorage প্রিফিক্স)।
- **আপডেটার:** চালু হলে `api.github.com/repos/RohanDaCoder/Pathagar/releases/latest` চেক করে
  (`updater.js`), semver তুলনা করে হোমে ব্যানার দেখায়, APK অ্যাসেট ডাউনলোডে নিয়ে যায়।
  ওয়েবে SW (`ptg-v<version>` ক্যাশ) অটো-হট-আপডেট করে।

## ডেভেলপমেন্ট ওয়ার্কফ্লো (PR-based)

আমরা PR-ভিত্তিক ডেভেলপমেন্ট অনুসরণ করি: **orchestrator** রিভিউ ও মার্জ করেন, **developer**
ব্রাঞ্চে কাজ করে PR পাঠায়।

```bash
# ১. ব্রাঞ্চ খুলুন
git switch -c feat/<নাম>

# ২. লোকাল টেস্ট (Netlify-এর মতোই: স্ট্যাটিক + /pdf/* প্রক্সি)
python3 scripts/local_proxy.py 8123      # → http://127.0.0.1:8123
npm install && npx cap sync android      # ওয়েব বদলালে সিঙ্ক

# ৩. কমিট + পুশ + PR
git add -A && git commit -m "feat: …"
git push -u origin feat/<নাম>
gh pr create --fill
# CI স্বয়ংক্রিয়ভাবে চলবে (JS checks + debug APK artifact)
```

`main`-এ সরাসরি পুশ নয় — সব পরিবর্তন PR দিয়ে। প্রতিটি PR-এ টেমপ্লেট চেকলিস্ট পূরণ করা হয়।

## রিলিজ প্রক্রিয়া (tag-based)

```bash
# 1. www/js/config.js-এ APP_VERSION আপডেট করে মার্জ করুন (যেমন '1.1.0')
# 2. ট্যাগ দিন ও পুশ করুন
git tag v1.1.0 && git push origin v1.1.0
# 3. GitHub Actions নিজেই: সাইনড Pathagar-v1.1.0.apk + pathagar-web-v1.1.0.zip
#    বানিয়ে GitHub Release প্রকাশ করবে
```

`versionCode` ট্যাগ থেকে অটো (major×১০০০০ + minor×১০০ + patch)। রিলিজ প্রকাশ হলে পুরনো
অ্যাপগুলোতে আপডেট ব্যানার দেখা যাবে।

### রিলিজ সাইনিং — একবার সেটআপ (orchestrator)

`pathagar-release-keystore/` ফোল্ডারে (ডেভেলপারের ডেলিভারি) keystore ও পাসওয়ার্ড আছে।
**এগুলো গোপন রাখুন ও ব্যাকআপ নিন — হারালে ভবিষ্যতের আপডেট পুরনো অ্যাপে ইনস্টল হবে না।**
রিপো সিক্রেটে সেট করুন (Settings → Secrets and variables → Actions):

```bash
gh secret set KEYSTORE_BASE64 < pathagar-release-keystore/keystore.base64
gh secret set KEYSTORE_PASSWORD < pathagar-release-keystore/PASSWORD.txt   # ভ্যালু ওই ফাইলে
gh secret set KEY_ALIAS --body "pathagar"
gh secret set KEY_PASSWORD  < pathagar-release-keystore/PASSWORD.txt
```

(প্রয়োজে `gh auth login` করে নিন।) সিক্রেট ছাড়া release workflow সাইনিং করবে না — আগে
সেট করে তারপর ট্যাগ পুশ করুন।

## ওয়েব ডিপ্লয় (Netlify)

**সবচেয়ে সহল (drag & drop):** [app.netlify.com/drop](https://app.netlify.com/drop) → `www`
ফোল্ডার টেনে ছাড়ুন — `_redirects`-এর `/pdf/*` প্রক্সি সহ লাইভ হবে।

**অটো-ডিপ্লয় (CI):** `netlify.yml` প্রস্তুত আছে; শুধু দুটি সিক্রেট যোগ করুন:
`NETLIFY_AUTH_TOKEN` (Netlify → User settings → Applications → Personal access tokens) এবং
`NETLIFY_SITE_ID` (Site settings → Site details → ID)। এরপর প্রতিটি main পুশে `www/` অটো
ডিপ্লয় হবে।

> টিপ: Android Chrome-এ সাইট খুলে **⋮ → Add to Home screen** চাপলে PWA হিসেবে ইনস্টল হয়।

## Android বিল্ড (লোকাল)

```bash
npm install                 # প্রথমবার (android প্রজেক্ট node_modules/@capacitor/android চায়)
npx cap sync android        # www/ বদলালে

# Debug APK
cd android && ./gradlew assembleDebug
# → app/build/outputs/apk/debug/app-debug.apk

# Signed release (android/keystore.properties + release.jks থাকলে)
./gradlew assembleRelease -PversionName=1.0.0 -PversionCode=10000
```

`android/keystore.properties` (gitignored) ফরম্যাট:
`storeFile=release.jks` · `storePassword=…` · `keyAlias=pathagar` · `keyPassword=…`

## কনফিগারেশন ও কী-রোটেশন

অ্যাপের **সেটিংস** পেজে API ঠিকানা, কী, প্রক্সি — সব বদলানো যায়, সাথে সংযোগ-পরীক্ষা।
API ৪০৩ দিলে ডেভেলপার কী বদলেছে — নতুন APK থেকে বের করুন:

```bash
apkscope decompile <নতুন apk> com.nahidnafiz.classninebooks.BuildConfig
```

## আইনি ও ব্যবহারের নোট

এই ক্লায়েন্ট শিক্ষার্থীদের **ব্যক্তিগত পড়াশোনার** জন্য। গাইড বইগুলোর স্বত্ব তাদের প্রকাশকদের;
মূল অ্যাপের ডেভেলপার বিজ্ঞাপনের মাধ্যমে সার্ভারের খরচ চালান। পুরো ক্যাটালগ (~14 GB) মিরর
করা বা পুনরায় বিতরণ করা এর উদ্দেশ্য নয় — নিজের পড়ার বইগুলো নামান, আর ভালো লাগলে মূল
অ্যাপটিও ব্যবহার করুন। রিপোতে শুধু কোড ও কনফিগ থাকে, কোনো PDF নয়।

---

# Pathagar (English summary)

A lightweight cross-platform client (Android + Web) for Class 9-10 guide books,
rebuilt from a reverse-engineering session of the original app. Single codebase:
a no-build **modular ES-module PWA** (`www/`) that Netlify serves as-is, and
Capacitor 6 wraps into the Android app — identical UI on both. Ships with:

- **CI** (PR + main): JS syntax gates, an `sw.js` precache coverage check, and a debug APK artifact.
- **Tag-based releases**: push `vX.Y.Z` → Actions builds the keystore-signed APK
  (versionCode derived from the tag) + web bundle, and publishes the GitHub Release.
- **In-app updater**: checks `releases/latest`, semver-compares, shows a Bengali
  banner linking the APK (web PWA hot-updates via service worker).
- **PR-based development**: `main` is protected (PRs required); every change goes
  through the PR template checklist.

Setup for the orchestrator: add the four signing secrets (`KEYSTORE_BASE64`,
`KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` — values in
`pathagar-release-keystore/`), optionally the two Netlify secrets, then push
`git tag v1.0.0` to publish the first release. **Back up the keystore folder** —
losing it means future updates can't install over existing installs.
