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
node multitrack.js     # multi-spotlight: two players followed in ONE pass on two.webm,
                       # each staying on its own through a crossing — plus the regression
                       # that auto-track no longer stops after four seconds
node smalltrack.js     # the real-world failure: a tiny player, a default ring, mown
                       # grass and look-alike team-mates — the ring must stay on HIM and
                       # not swap onto the team-mate crossing the other way
node lockon.js         # Lock-On model runtime: the vendored detector boots from
                       # file:// with zero network, YOLOX decode/NMS proved on
                       # fabricated tensors, a default Follow press with the real
                       # model and nobody to detect hands itself to the template
                       # tracker, and index.html ALONE still runs the v3.7
                       # tracker (loader reports absent, report says so)
node lockontrack.js    # tracking-by-detection, end to end with a SCRIPTED
                       # detector (boxes from the fixtures' own motion math):
                       # default-on + the off switch, identity through a crossing, both
                       # players in one pass, occlusion carried + re-found,
                       # honest loss + one-tap resume stitching, the 40s no-cap
                       # clip, same-kit check-this-moment flags, association
                       # unit checks (motion keeps identity, colour splits teams)
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
node friction.js       # friction backlog: no control fails silently without a video,
                       # every delete is undoable from its own message (even after later
                       # edits), whole-game export states its length
node walkthrough.js    # fresh-eyes walkthrough: drives the whole first-time journey and
                       # screenshots every step into out/walk_*.png (the evidence for
                       # "could someone who has never seen this work it out alone?")
node board.js          # tactics board: formation seeding, chip place/drag/rename,
                       # drawing tools, format switch, clip-linked boards, PNG, persistence
node compare.js        # side-by-side: lockstep sync, pair looping, frame-step both,
                       # align nudge, outside file as model side, composite PNG
node library.js        # game-film folder library: stubbed showDirectoryPicker with real
                       # video bytes — listing, one-click open, has-work marker, fallback
node continuity.js     # cross-device continuity: the project written next to its video
                       # in the Games folder, a second device picking it up, newest-wins
                       # when both have work, and silent fallback when the folder is
                       # read-only or the video came from somewhere else
node trends.js         # progress dashboard: cross-game totals from localStorage and the
                       # Games folder, a bar per game in date order, most-used labels,
                       # early-vs-recent movement, filters, and the CSV export
node insights.js       # session insights: "asked before / sees it now" grouping of his
                       # answers across sessions, the work-on thread, escaping of his
                       # free text, and the position filter scoping his answers too
node voice.js          # voice-over: recording over a clip (stubbed mic emitting a real
                       # WAV), storage in IndexedDB rather than the project file, and the
                       # export timeline inspected as PCM — the narration plays, goes
                       # quiet under a question freeze, and resumes after it
node bundle.js         # season bundles: the hand-rolled zip opened by a REAL unzip
                       # (listing + checksum test), what is packed, the readme, and the
                       # packed project loading back into the app. Needs `unzip` on PATH
FFMPEG=... node muxer.js  # proves the hand-rolled mp4 writer against REAL H.264 + AAC:
                          # ffmpeg-encoded samples through buildMp4(), round-tripped
                          # through the app's demuxMp4Audio(), probe + full decode
node realeval/selftest.js # proves the real-footage eval harness itself: scoring on
                          # fabricated paths where the right answer is known (switch
                          # detection, honest-loss accounting, the WIN/TIE/LOSS gate),
                          # then a real tracking run over synthetic ground truth
```

### Real-footage eval (`realeval/`)

The gate for every v4+ tracker change: replays REAL clips (gitignored, never in
the repo) through the tracker and scores them against hand-dragged ground-truth
paths. `node realeval/run.js` runs the set; `--save-baseline` freezes the
numbers a change must beat; `--gate` fails on any regression. See
`realeval/README.md` for how to add clips and why synthetic fixtures alone are
not trusted for real-footage conclusions.

Notes
- Chromium is resolved from `$CHROME_PATH`, else the newest `chromium*` under
  `/opt/pw-browsers` / `$PLAYWRIGHT_BROWSERS_PATH`, else playwright-core's default.
- Fixtures are WebM because Playwright's Chromium has no H.264 decoder. Real
  Chrome/Safari play mp4/mov fine — this is a test-environment limitation only.
- The app exposes `window.__filmroom` (`getProject()`, `spotPos()`) for assertions.
- The template-tracker suites (`tracking`, `hardtrack`, `multitrack`, `smalltrack`)
  pin `filmroom:lockonPath` to `"off"`: detection is the app default since the
  2026-08-25 flip, and which path a COCO model picks on a synthetic fixture is an
  accident of the fixture (it sees the body-shaped player in `feet.webm`, nothing
  in the rectangles). They regression-test the fallback everyone without
  `lockon.js` still gets; the detection path has `lockon.js`/`lockontrack.js`
  and the realeval harness.
- Exit code 0 = all green; anything printed as `FAIL`/collected error is a real problem.

### Fixture difficulty

The synthetic fixtures are easier than real film, and it matters. Measured
distinctiveness (how well a default-ring patch tells itself apart from the field):
`small` 0.812, `pan` 0.869, `trees` 0.742, `exit` 0.799 — all matching at 0.96+.
A real far-sideline clip that defeated the tracker measured **0.489**, matching in the
0.6-0.8 band. Three rounds of reproduction fixtures passed because of that gap.

`faint.webm` is built to the measurement instead: muddy 5x13 smudges on noisy textured
grass, three of them crossing at the same depth, largest candidate patch scoring 0.43.
It reproduced the failure on the first run. `exit.webm` covers a player who simply runs
out of shot, where the only honest answers are "inside the picture" and "lost him".

`body.webm` gives the player a head, a torso and two legs that scissor as he runs, with
a look-alike in the same kit crossing him. Every other fixture's player is a solid
rectangle — no stance, no legs, no gap between them — which makes them useless for any
question about matching a player's shape. A square template fails this clip at err 0.142
(t=5) and 0.403 (t=7).

`crowd.webm` packs five players within a few dozen pixels under a dark sideline band —
where "everything that is not grass" is one connected blob and the outline fit has to
refuse rather than return the lot. `dim.webm` is one isolated player on ground textured
enough that even a box cut to him scores poorly, which is where a threshold derived only
from the background outruns what the tracker can actually achieve.

When adding a tracking fixture, check what it actually scores
(`window.__filmroom.trackReport`) before trusting that it reproduces anything — and
check that its player is shaped like a player if shape is what you are testing.
