# Film Room tests

Playwright smoke tests that drive the real app (`../index.html`) in headless Chromium.
Run them before every push.

```sh
npm install            # installs playwright-core only
./make-fixtures.sh     # generates tests/fixtures/*.webm (needs ffmpeg; see script header)
node smoke.js          # core suite: loading, drawing tools, decision points, clips,
                       # exports, undo, autosave restore (21 checks)
node tracking.js       # auto-track suite: tracks a synthetic moving ball and asserts
                       # the spotlight follows it within tolerance
```

Notes
- Chromium is resolved from `$CHROME_PATH`, else the newest `chromium*` under
  `/opt/pw-browsers` / `$PLAYWRIGHT_BROWSERS_PATH`, else playwright-core's default.
- Fixtures are WebM because Playwright's Chromium has no H.264 decoder. Real
  Chrome/Safari play mp4/mov fine — this is a test-environment limitation only.
- The app exposes `window.__filmroom` (`getProject()`, `spotPos()`) for assertions.
- Exit code 0 = all green; anything printed as `FAIL`/collected error is a real problem.
