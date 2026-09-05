# Real-footage eval harness (v4 "Lock-On", Phase 0)

**This is the gate.** From v4 on, no tracker change ships unless this harness
shows it beating or matching the previous build **on real clips**. The
synthetic fixtures in `tests/fixtures/` stay as regressions, but no conclusion
about real footage is drawn from them again — nine builds (v2.5–v3.7) chased
the wrong thing because fixtures differed from real film in ways nobody had
measured.

## What it does

For each case it drives the real app exactly the way a person does: loads the
video, drops a ring on him at the anchor moment, presses Follow, and then
scores the path the tracker wrote against **hand-dragged ground truth**:

- **on-him %** and error stats (mean / median / p90 / max, normalized units)
- **coverage** — how much of the ground-truth span it stayed with him
- **identity switches** — stretches where the ring is on a labelled look-alike
  while he is somewhere else. The acceptance bar for the epic is **zero**.
- **honest-loss accounting** — once the tracker *reports* lost, it stops being
  charged position error (a tracker must never score better by bluffing than
  by admitting it lost him; a ring silently parked on grass keeps charging
  full error)
- when he genuinely leaves the frame, whether the loss was reported within 1s

## The clips (this needs you)

The harness needs **3–5 real clips** in `clips/` — which is **gitignored**:
the footage never enters the repo, in the same spirit as it never leaving the
machine. The set should include at least:

1. one **same-kit crossing** (a teammate crosses right over/past him),
2. one **occlusion** (he goes behind another player / the keeper),
3. one **camera pan** (sideline follow),
4. one where he **leaves the frame**.

### Making a case

1. Open the clip in Film Room and track him **by hand**: put the ring on him,
   then scrub through and drag/pin the ring on him every second or so — through
   the crossing, behind the occlusion, all the way. Manual tracking works, and
   those keys ARE the ground truth. (If Auto-track already holds part of the
   clip, run it and correct it by hand wherever it is off — what matters is
   that the saved keys are *right*, not how they got there.)
2. For a same-kit crossing, add a **second ring on the look-alike** and track
   that player by hand through the crossing too. Label it something like
   `look-alike`. That is what lets the harness *measure* an identity switch.
3. Save the project (💾, or **📦 Keep this game** — the bundle's
   `project.filmroom.json` is the same file; `prep.sh` unpacks bundle zips
   dropped into `clips/`).
4. Make a folder per case and put two files in it:

   ```
   clips/crossing-vs-slammers/
     firsthalf.mp4              ← the RAW footage
     firsthalf.filmroom.json    ← the project with the hand-dragged keys
   ```

   **The footage must be raw** — never an exported/annotated clip. Exports have
   the ring burned into the pixels, and a tracker following a painted ring is
   not being tested on anything. A trim of the game video is fine (Photos /
   QuickTime trim, no overlays); if the trim starts at, say, 12:40 of the
   original, set `"timeOffset": 760` in the manifest so the project's times
   line up with the trimmed file.

5. Optional `manifest.json` in the folder:

   ```json
   {
     "him": "Jude",              // spot label to evaluate (default: most keys)
     "decoys": ["look-alike"],   // labels of rings on look-alikes (default: every other ring)
     "anchor": 12.4,             // where the run starts (default: his first key)
     "direction": 1,             // 1 = follow forward (default), -1 = work backwards
     "timeOffset": 0,            // if the video is a trim of the original game
     "expectLost": [[30, null]], // windows where he is genuinely out of frame
     "tol": 0.03,                // "on him" radius (normalized; default 0.03)
     "notes": "same-kit crossing at ~0:18"
   }
   ```

## Running it

The short way, from a Games folder the app has already been used in (the app
saves each game's project next to its video there, and a ring you tracked by
hand IS ground truth):

```sh
cd tests && npm install                                   # once
node realeval/import.js "/path/to/Game-Film" --dry-run    # says what it found
node realeval/import.js "/path/to/Game-Film"              # makes clips/<case>/ (video symlinked, project copied)
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node realeval/run.js --path detect --gate
```

Real Chrome decodes the iPhone footage as it is; without `CHROME_PATH`, run
`./realeval/prep.sh` first so ffmpeg makes the WebM transcodes the test
Chromium needs. iCloud placeholders (cloud icons in Finder) are skipped until
they are downloaded.

By hand:

```sh
cd tests && npm install       # once
./realeval/prep.sh            # only needed for H.264 clips or bundle zips
node realeval/run.js          # run every case, write out/eval-<build>.json
node realeval/run.js --save-baseline   # freeze the numbers a change must beat
node realeval/run.js --gate            # exit 1 if anything regresses vs baseline
node realeval/selftest.js     # prove the harness itself (part of npm test)
```

The bundled test Chromium cannot decode H.264. Either run `prep.sh` (makes a
one-time `.eval.webm` transcode next to each mp4/mov) or set `CHROME_PATH` to
a real Chrome.

## The workflow for a tracker change

1. On the **old** build: `node realeval/run.js --save-baseline`
2. Make the change.
3. `node realeval/run.js --gate` — every clip must come back WIN or TIE.
   A LOSS on any clip means it does not ship, whatever the synthetic fixtures
   say.
4. Paste the per-clip numbers into PLAN.md's decision log entry for the change.

## The two trackers (the flip happened 2026-08-25)

Detection is the app's default tracker since 2026-08-25 — this harness showed
it beating the template tracker on every clip in the acceptance set (numbers
in PLAN.md's decision log). Both stay measurable:

```sh
node realeval/run.js --save-baseline          # whatever baseline you're gating against
node realeval/run.js --path detect            # detection-led (the app default)
node realeval/run.js --path template          # the v3.7 tracker, forced via the off switch
```

Each case prints `[ran as: detection]` (or `template`, if nobody was detected
at the anchor and the run fell back). Every future tracker change still faces
the same rule: beat or match the committed baseline on every clip, with the
verdict measured as time-on-him, or it does not ship.

`baseline.json` and `out/` hold only numbers about tracker runs (positions,
scores, times) — never frames or footage. `out/` also keeps the app's own
tracking report per case (`<case>-report.json`) for diagnosis.

## Ball ground truth (v6)

To open the v6-A ball gate, add a second hand-dragged ring labelled exactly
`ball` to any case's project and track the ball with it wherever it is
visible (gaps are fine — coverage is only asked where you could see it).
The harness excludes that ring from him/decoys automatically and prints a
`ball:` line per case — coverage where marked, mean error, on-ball % — plus
the possession windows the tracker derived.

## The Moment Finder gate (v6)

`node realeval/moments.js` grades the finder against games already broken
down by hand: a case folder whose project has his SAVED CLIPS (they are the
ground truth for "what this family calls a moment") plus a detect report over
the same span. It replays the SHIPPED `momentCandidates()` in the real page
and prints, per game: recall of his chosen moments (bar ≥80%) and review cost
in candidates per accept (bar ≤4). The finder ships as an offer either way —
this gate decides when its numbers are worth advertising.

## The Auto-Cut gate (v6)

`node realeval/autocut.js` measures the tightening proposals against the
parent's own hand-set trims, on the same project+report pairs the Moment
Finder gate uses: each saved clip is widened 3s per side (the loose cut a
person starts from), the SHIPPED `proposeCut()` tightens it in the real page,
and the proposal's ends are compared with where the parent actually cut.
Ship bar: median within 1.5s per end. No-opinion clips are reported, not
punished — a null is honest.

## The 9:16 reframe check (v5)

`node realeval/reframe.js` measures the social cut's acceptance on the real
clips: does the auto-reframed 9:16 crop keep him in frame ≥95% of the cut?
Pure arithmetic over an existing `--path detect` run's tracked path (the same
follow math the renderer ships) against the hand-dragged ground truth. Run
`node realeval/run.js --path detect` first; clips without a report are
skipped with a note.

## Self-test

`selftest.js` proves the instrument before it judges anything: fabricated
paths where the right answer is known by construction (a perfect track scores
perfect, a track that follows the look-alike is counted as a switch, honesty
about losing him scores better than bluffing, the WIN/TIE/LOSS gate fires
correctly) — then one real end-to-end run over `small.webm` with ground truth
generated from the fixture's own motion expressions. It runs as part of
`npm test`, so the harness cannot silently rot.
