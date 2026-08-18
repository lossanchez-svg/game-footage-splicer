# Film Room — Product Plan & Roadmap

This is the source of truth for where the project is and where it's going.
**Keep it updated**: when a feature lands, check it off; when a decision is made, log it.

## Vision

A daily-use film-study tool for a parent breaking down youth soccer footage with their
player (currently a 10-year-old attacking mid / winger in 9v9, Southern California club
soccer). The goal is **self-awareness, not criticism**: help him see what he actually
looks like on the field vs. what he thinks is happening — high-IQ decisions, bad
decisions, great and heavy touches, good and bad risks, space to take and space to make,
options under pressure, and the defensive positioning/effort side of the game.

Guardrails that shape every feature:
- **Positive framing is a feature.** Ratings are 👍 Strength / 🔧 Work-on / 💡 Teachable
  (never "good/bad player"). The Coach tab pushes questions over lectures and
  "2 things done well, 1 to work on — in his words."
- **Questions before answers.** Decision points make him commit to an answer before the
  film reveals what happened. Anything that grows game IQ through *his* observation
  beats annotating harder.
- **Dad-usable daily.** If a feature needs a terminal, a build step, or an account, it
  doesn't ship. One HTML file, double-click, done.

## Design inputs from the user (2026-08-18)

Answers to the open design questions — these drive the roadmap ordering:

1. **Where review happens:** phone, iPad, or TV mirroring — *not* at the Mac.
   → The Mac is the *editing* station; **exports are the product** the family consumes.
   Touch/iPad support and guaranteed-iOS-playable exports matter more than editor polish.
2. **Quality bar:** must look good on an **80″ TV**. → Export at high resolution
   (up to 1080p+) with TV-appropriate bitrate; no low-res shortcuts.
3. **Footage:** sideline iPhone (zoomed out, sometimes close up) + older **Trace camera**
   YouTube film (zoomed out, sometimes fuzzy). → Players can be small in frame:
   spotlight ring size must be adjustable (also tunes the tracker patch), and smarter
   tracking for far/fuzzy targets is promoted on the roadmap.
4. **Vocabulary:** Claude's tag language is fine as a default, but it must be
   **editable** so terms can match what he hears from his coach.
5. **Viewing mode:** together *and* solo — his mother may run the session, or he may
   watch alone. → **Exports must carry their own context**: what the moment is, what
   went wrong / what should happen, and the decision question — with no narrator needed.

## Product principles (technical)

1. **Single self-contained `index.html`.** No build step, no dependencies, no network.
   Runs from `file://` in Chrome/Safari on a Mac. The file can be copied/AirDropped
   anywhere and still works.
2. **Footage never leaves the machine.** Local files only; localStorage autosave;
   downloadable `.filmroom.json` project files for portability/backup.
3. **All positions, all formats.** Attacking mid + winger get first-class content, but
   the data model (position/format tags, taxonomy) covers GK→striker and 5v5→11v11.
4. **Footage sources:** iPhone videos (AirDrop / Photos export) and screen recordings of
   YouTube film (⌘⇧5). We deliberately do **not** download from YouTube (ToS) — the
   screen-record workflow is the supported path.

## Current state

### ✅ v1 — core tool (shipped)
- Video loading via picker or drag-drop (`.mp4`/`.mov`/`.m4v`/`.webm`)
- Study transport: play/pause, ¼–1× speeds, frame-step (fps setting), 5s jumps,
  scrubbable timeline showing clip spans + annotation marks, J/K/L + full shortcuts
- Telestration (normalized 0–1 coords, per-annotation visible time window):
  - 🔦 **Spotlight**: colored ring + name label, follows a player via keyframes
    (linear interpolation; drag while selected to keyframe at the playhead)
  - ➡️ **Arrows** with semantics: pass (solid) / run (dashed) / dribble (wavy) / shot (heavy)
  - ▨ **Zones** (rect/ellipse) for space to take/make/cover
  - ✍️ Freehand pen, 🔤 text callouts
- 🧠 **Decision points**: auto-pause + question overlay before the reveal
- 🎬 **Clip library**: In/Out marking, title, 👍/🔧/💡 rating, tag taxonomy
  (on-ball / decisions & risk / off-ball attack / defense / moments), position + format
  tags, notes, looping playback, filters by rating and tag
- Exports: annotated clip → video file (MediaRecorder, mp4 in Safari / webm-or-mp4 in
  Chrome, audio passed through when supported); annotated still → PNG
- Persistence: per-video localStorage autosave (key: `filmroom:<name>:<size>`),
  project save/load as JSON, undo stack (⌘Z)
- Coach tab: 9v9 attacking-mid & winger cheat sheets, defensive principles,
  ask-don't-tell question list, 5v5→11v11 format notes
- First-run help modal + full help reference

### ✅ v1.1 — auto-tracking (shipped)
- 🎯 **Auto-track**: with a spotlight selected, one button tracks the player from the
  playhead to the spotlight's End time — no manual keyframes. Pure-JS template matcher
  (RGB SAD, coarse-to-fine search, slowly-adapting template) sampling ~8 frames/sec via
  seek-stepping; writes keyframes live, then thins them (RDP) so the result stays
  hand-editable. Detects when it loses the player and tells you where to re-anchor.
  Cancel with Esc. Works on top of, not instead of, manual keyframing.

### ✅ v1.2 — TV-ready, self-explanatory exports (shipped)
Driven directly by the design inputs above:
- **TV-quality export**: renders at up to 1920px wide (was 1280) with bitrate scaled to
  resolution (~12 Mbps at 1080p) — holds up on an 80″ TV.
- **Exports explain themselves** (solo/mom-run viewing): clip exports open with a burned-in
  title card (title, 👍/🔧/💡 rating, position/format, the coaching note), and any
  decision point inside the range becomes a burned-in freeze-frame showing the question
  before the play continues — the "what should happen here?" moment works without dad.
- **Editable tag vocabulary**: tag names can be renamed/removed/added (per group) to match
  the coach's language; renames update existing clips; stored in the browser and embedded
  in project files; one-click reset to defaults.
- **Adjustable spotlight ring size** (Ring −/＋): smaller rings for zoomed-out
  iPhone/Trace footage — also right-sizes the auto-tracker's match patch.

### ✅ v1.3 — iPad/touch + iPhone-native mp4 export (shipped)
- **Touch support**: full editor works by touch — pointer-event tools, bigger targets on
  coarse pointers, taller timeline, 16px inputs (stops iOS focus-zoom), no tap-highlight/
  double-tap zoom, safe-area padding. Responsive layout stacks the sidebar under the
  video below 980px (iPad portrait / phones).
- **PWA (when hosted)**: manifest + service worker + icons; register only over http(s).
  One-time setup: enable GitHub Pages on this repo → open on iPad Safari → share →
  Add to Home Screen. Fully offline afterwards; footage still never leaves the device.
  Opening index.html locally stays fully supported (SW is a no-op on file://).
- **⚡ WebCodecs H.264 export**: renders frame-by-frame (seek-stepping, deterministic —
  no dropped frames) through VideoEncoder into a **hand-rolled zero-dependency ISO-BMFF
  muxer** (`buildMp4`) → real `.mp4` that plays natively on iPhone/iPad from ANY browser.
  Baseline profile (no B-frames), keyframe every 2s, same title-card/freeze burn-ins.
  Silent by design; the MediaRecorder path remains as "🔊 with audio" via a top-bar
  selector (remembered). Falls back to realtime path automatically if encoding fails.

### ✅ v1.4 — tracker v2 for zoomed-out / fuzzy footage (shipped)
Rebuilt `autoTrack` matching around per-channel-centered **ZNCC** (immune to the
auto-exposure/brightness drift and low contrast that broke SAD on Trace-style film),
with: **adaptive working resolution** driven by ring size (small ring on a far player →
higher-res frame, so the patch keeps enough pixels), **velocity prediction** centering
each search on where the player is heading (survives camera pans/fast runs),
**coast-through-occlusion** (up to 5 samples on predicted motion when players cross,
provisional keys rolled back if never reacquired), a frozen **anchor template** guarding
against adaptive-template drift, and mild **multi-scale** matching for slow zoom changes.
The tracking pill now shows live lock quality, and `window.__trackTrace` records
per-sample diagnostics. Verified by `tests/hardtrack.js`: an 18px target on a noisy
field with breathing exposure and an occluder crossing straight over it — tracked
through the crossing with ≤0.004 normalized error; clean-footage regression unchanged.

## Roadmap

### Next (reordered per design inputs, highest value first)
- [ ] **Audio in fast exports**: decode source audio (WebCodecs AudioDecoder or
      decodeAudioData on clip ranges), AAC-encode where supported, extend buildMp4 with
      an mp4a/esds track. Until then: realtime path keeps audio.
- [ ] **Highlight reel builder**: select multiple clips → one stitched export, each with
      its title card. The weekly package for the TV.
- [ ] **Session builder**: ordered clip playlist with per-clip questions, runnable as a
      guided session by mom or solo; logs his answers.
- [ ] **Field-diagram mode**: tactics-board panel for teaching schemes off-video.
- [ ] **Side-by-side compare**: two clips in sync — "your touch vs. the model touch."

### Later
- [ ] Track multiple spotlights in one pass; track backwards from an anchor.
- [ ] Per-player trend dashboard: tag counts across games/projects, CSV export.
- [ ] Project bundles: zip of project JSON + exported clips for archiving a season.
- [ ] Voice-over recording on exports (mic + video mux) for narrated teaching clips.

## Open questions (check before building the next feature)

- **Trace footage**: Trace accounts can usually download game video as mp4 files
  directly from their portal — much better quality than screen-recording YouTube.
  Can the user (or whoever shares the film) download from Trace? If yes, document that
  as the preferred path.
- **TV setup**: AirPlay from an iPhone/iPad, or HDMI from the Mac? Affects whether
  exports or the app itself is the TV path (currently assuming exported files + AirPlay).
- **Coach's vocabulary**: is there a specific term list from his club/coach to preload
  into the tag editor?
- **Solo sessions**: is exported-video context enough, or should the session builder
  (guided in-app flow that logs his answers) move up the list?

### Explicitly not planned
- YouTube downloading (ToS) — screen recording is the supported path.
- Accounts, cloud sync, uploads of any kind.
- Build tooling / frameworks. It's one file on purpose.

## Architecture notes (for future sessions)

- **Everything is in `index.html`**: CSS → HTML → one `<script>` (plain JS). The extra
  repo files (`manifest.webmanifest`, `sw.js`, `icon-512.png`, `apple-touch-icon.png`)
  only matter when the app is hosted; the single file stays fully standalone.
- **Data model** (`project`): `{ version, videoName, videoKey, fps, annotations[], clips[] }`
  - annotation types: `spot {keys:[{t,x,y}], r, color, label, tStart, tEnd}`,
    `arrow {x1,y1,x2,y2, style, color, label, tStart, tEnd}`,
    `zone {x,y,w,h, shape, color, label, tStart, tEnd}`,
    `pen {points[], color, tStart, tEnd}`, `text {x,y,text,color,tStart,tEnd}`,
    `pause {t, question}` (decision point)
  - clips: `{id, tIn, tOut, title, rating, tags[], notes, position, format}`
  - All coordinates normalized 0–1 against the displayed video → resolution-independent.
- **Key functions**: `drawScene(ctx, W, H, t, opts)` renders annotations at time `t` into
  any canvas (overlay AND export share it); `spotPos()` interpolates spotlight keyframes;
  `mutate(fn)` wraps all state changes (undo push + persist + re-render);
  `exportRange()` = canvas composite + `captureStream` + MediaRecorder, realtime playthrough;
  `autoTrack(spot)` = the tracker (see v1.1 above); `tick()` = main rAF loop.
- **Testing**: Playwright smoke tests in `tests/` (see `tests/README.md`). Test Chromium
  lacks H.264 → fixtures are WebM. `window.__filmroom` exposes `getProject()`/`spotPos`
  for assertions. **Run the smoke tests before every push.**

## Decision log

| Date | Decision | Why |
| --- | --- | --- |
| 2026-08-18 | Single-file vanilla JS app, no build | Daily usability for a non-developer; AirDrop-able; zero maintenance |
| 2026-08-18 | Canvas overlay with normalized coords | Survives window resize; same draw code serves screen + full-res export |
| 2026-08-18 | MediaRecorder realtime export | Only dependency-free option; WebCodecs upgrade tracked in roadmap |
| 2026-08-18 | localStorage autosave keyed by file name+size | Reopening the same footage restores work without any save step |
| 2026-08-18 | No YouTube download; screen-record workflow | YouTube ToS; user already screen-records |
| 2026-08-18 | Tracker = pure-JS SAD template matching at ~8 samples/sec, RDP-thinned into ordinary keyframes | No dependencies; output stays hand-editable; manual keyframing remains the fallback when tracking loses the player |
| 2026-08-18 | Exports are the primary family-facing product (Mac = edit station) | User: review happens on phone/iPad/TV mirroring, often without the editor present |
| 2026-08-18 | Burn context INTO exports (title card, coaching note, decision-question freeze) | Clips must teach on their own when mom runs the session or he watches solo |
| 2026-08-18 | Export up to 1920px wide, bitrate scaled to resolution | 80″ TV quality bar; 1280 cap was an editor-era default |
| 2026-08-18 | Tag taxonomy is editable data, not hardcoded | Must be able to match the coach's verbiage; Claude's wording is only the default |
| 2026-08-18 | PWA files (manifest, sw.js, icons) are optional hosting enhancements | index.html must stay fully functional standalone from file://; hosting (GitHub Pages) is the iPad install path |
| 2026-08-18 | Hand-rolled mp4 muxer + baseline H.264, keyframes every 2s | Zero dependencies; baseline forbids B-frames so the simple muxer (no ctts) is always correct; validated against real H.264 in tests/muxer.js |
| 2026-08-18 | Fast exports are silent; audio stays on the realtime path for now | AAC encode/mux is a large addition; game audio rarely carries the teaching; roadmap item tracks adding it |
| 2026-08-18 | Tracker ZNCC centers each RGB channel separately | With one global mean, every grass patch correlates ~0.6 with the template's green component and the tracker "matches" anywhere; per-channel centering makes uniform background score ~0 (found via trace on the hard fixture) |

## Working agreements for future sessions

- Develop on the designated feature branch; run `tests/` smoke suite before pushing.
- Keep `index.html` self-contained — no external requests, no libraries.
- Update this file (feature checkboxes, decision log) as part of any feature commit.
- Preserve backward compatibility of the project JSON (`version` field exists for
  migrations if the schema must change).
