# Film Room tests

Playwright smoke tests that drive the real app (`../index.html`) in headless Chromium.
Run them before every push.

```sh
npm install            # installs playwright-core only
./make-fixtures.sh     # generates tests/fixtures/*.webm (needs ffmpeg; see script header)
node tour.js           # guided first-run tour: do-based advancement through all five
                       # steps, wording that follows the task, skip, restart from Help,
                       # never-again-after-completion, resize + touch
node tips.js           # tooltips + one-time hints: hover delay, long-press on touch
                       # (without pressing the control), a tip on every control, and
                       # each contextual hint firing exactly once, ever
node plainwords.js     # plain-language pass: renamed controls, the Advanced disclosure,
                       # jargon sweep over every visible surface, toasts that are full
                       # sentences, plus a screenshot walk through every tab and mode
node smoke.js          # core suite: loading, drawing tools, decision points, clips,
                       # exports, undo, autosave restore
node tracking.js       # auto-track suite: tracks a synthetic moving ball and asserts
                       # the spotlight follows it within tolerance
node hardtrack.js      # hard-mode tracking: small target on a noisy field with
                       # breathing exposure and an occluder crossing straight over it
                       # (coast-through-occlusion + reacquire)
node touch.js          # touch/iPad suite: responsive layout + tap interactions
node fastexport.js     # WebCodecs mp4 export: end-to-end where H.264 encode exists,
                       # stubbed-encoder flow checks (frame counts, cadence) otherwise
node session.js        # guided session: question-first flow, answer capture, recap,
                       # session log + notes file + reload persistence
node watch.js          # the "this week's session is ready" front door: when it appears,
                       # what it says, starting the session, XL session type, dismissal
                       # lasting the visit and the offer returning next time
node comfort.js        # comfort mode + accessibility: the Aa text-size toggle (sizes,
                       # persistence, longer toasts), a real WCAG AA contrast audit of
                       # every screen in both sizes, and visible keyboard focus
node board.js          # tactics board: formation seeding, chip place/drag/rename,
                       # drawing tools, format switch, clip-linked boards, PNG, persistence
node compare.js        # side-by-side: lockstep sync, pair looping, frame-step both,
                       # align nudge, outside file as model side, composite PNG
node library.js        # game-film folder library: stubbed showDirectoryPicker with real
                       # video bytes — listing, one-click open, has-work marker, fallback
FFMPEG=... node muxer.js  # proves the hand-rolled mp4 writer against REAL H.264 + AAC:
                          # ffmpeg-encoded samples through buildMp4(), round-tripped
                          # through the app's demuxMp4Audio(), probe + full decode
```

Notes
- Chromium is resolved from `$CHROME_PATH`, else the newest `chromium*` under
  `/opt/pw-browsers` / `$PLAYWRIGHT_BROWSERS_PATH`, else playwright-core's default.
- Fixtures are WebM because Playwright's Chromium has no H.264 decoder. Real
  Chrome/Safari play mp4/mov fine — this is a test-environment limitation only.
- The app exposes `window.__filmroom` (`getProject()`, `spotPos()`) for assertions.
- Exit code 0 = all green; anything printed as `FAIL`/collected error is a real problem.
