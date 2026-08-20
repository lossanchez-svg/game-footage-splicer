# Film Room — dev notes

Read **PLAN.md first** — it is the source of truth for the vision, guardrails, current
feature state, roadmap, architecture notes, and decision log. Update it (checkboxes +
decision log) as part of any feature commit.

## What this is

A single-file (`index.html`), zero-dependency, browser-based soccer film-study tool a
parent uses daily to break down their kid's game footage. It must always work by
double-clicking `index.html` — no build step, no libraries, no network requests, footage
never leaves the machine.

## Layout

- `index.html` — the entire app (CSS + HTML + one plain-JS `<script>`)
- `lockon.js` — optional vendored on-device player detector (onnxruntime-web +
  YOLOX-Nano, gzip+base64 in one file; regenerate with `tests/make-lockon.js`).
  `index.html` must always keep working without it (v3.7 tracker fallback)
- `manifest.webmanifest`, `sw.js`, `icon-512.png`, `apple-touch-icon.png` — optional PWA
  files, only active when hosted (e.g. GitHub Pages for iPad home-screen install);
  `index.html` must always keep working standalone from `file://`
- `PLAN.md` — product plan / roadmap / architecture / decisions
- `README.md` — user-facing docs (keep in sync when features change)
- `tests/` — Playwright smoke tests + fixture generation (see `tests/README.md`)

## Testing (do this before every push)

```sh
cd tests
npm install            # playwright-core only
./make-fixtures.sh     # needs any ffmpeg on PATH (or pip install imageio-ffmpeg)
npm test               # smoke, tracking, touch, fastexport, muxer suites
```

Notes:
- The Playwright Chromium build has no H.264 → fixtures are WebM. Real Chrome/Safari
  play mp4/mov fine.
- `window.__filmroom` exposes `getProject()` and `spotPos()` for test assertions.
- Set `CHROME_PATH` if the default Chromium path in the test scripts doesn't exist.

## Conventions

- Plain JS, no frameworks, no TypeScript, no modules — one `<script>` tag.
- All drawing coordinates normalized 0–1; `drawScene()` must stay usable for both the
  live overlay and full-resolution export rendering.
- Every state change goes through `mutate()` (or `pushUndo()` + `persist()` + renders)
  so undo/autosave keep working.
- Keep project JSON backward compatible (`version` field is there for migrations).
