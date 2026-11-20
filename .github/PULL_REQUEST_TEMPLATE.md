## What changes?

<!-- Which files/features changed, and why — briefly -->

## Testing

- [ ] Web: `python3 scripts/local_proxy.py` → http://127.0.0.1:8123 — lists, download, offline read
- [ ] Android: `./gradlew assembleDebug` (or `assembleRelease` for release changes)
- [ ] CI is green

## Checklist

- [ ] Any new `.js` file was added to the `www/sw.js` precache list (CI verifies this)
- [ ] `APP_VERSION` in `www/js/config.js` was bumped if needed
- [ ] No copyrighted content (PDFs/text) was added to the repo — code and config only
- [ ] Personal-use scope respected (no mirroring/redistribution)
