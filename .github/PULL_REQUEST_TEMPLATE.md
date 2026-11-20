## What changes?

<!-- Which files/features changed, and why — briefly -->

## Testing

- [ ] Web: `bun run dev` (or `bun run build && bun run serve` → http://127.0.0.1:4173) — lists, download, offline read
- [ ] `bun check && bun fmt --check && bun run lint && bun test && bun run build` all pass
- [ ] Android: `bun run build && bun run cap:sync && bun run build:apk` (CI builds the debug APK too)
- [ ] CI is green

## Checklist

- [ ] `APP_VERSION` in `src/config.ts` and `version` in `package.json` were bumped together, if needed
- [ ] New runtime dependencies discussed (pdfjs-dist stays pinned at 3.11.174)
- [ ] No copyrighted content (PDFs/text) was added to the repo — code and config only
- [ ] Personal-use scope respected (no mirroring/redistribution)
