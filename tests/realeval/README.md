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

## Judging the v4 detection path (the flip decision)

The v4 tracking-by-detection path ships **off by default** until this harness
shows it winning. With the real clips in place:

```sh
node realeval/run.js --save-baseline          # the v3.7 template tracker
node realeval/run.js --path detect            # the same clips, detection-led
```

Each case prints `[ran as: detection]` (or `template`, if nobody was detected
at the anchor and the run fell back). If detection beats or matches the
baseline on every clip — and shows zero identity switches through the same-kit
crossings — flip the default (see PLAN.md) and record the numbers in the
decision log. If it loses anywhere, it stays off and the numbers say why.

`baseline.json` and `out/` hold only numbers about tracker runs (positions,
scores, times) — never frames or footage. `out/` also keeps the app's own
tracking report per case (`<case>-report.json`) for diagnosis.

## Self-test

`selftest.js` proves the instrument before it judges anything: fabricated
paths where the right answer is known by construction (a perfect track scores
perfect, a track that follows the look-alike is counted as a switch, honesty
about losing him scores better than bluffing, the WIN/TIE/LOSS gate fires
correctly) — then one real end-to-end run over `small.webm` with ground truth
generated from the fixture's own motion expressions. It runs as part of
`npm test`, so the harness cannot silently rot.
