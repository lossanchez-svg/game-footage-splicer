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

## Roadmap

### Next (highest value, roughly in order)
- [ ] **Highlight reel builder**: select multiple clips → export one stitched video
      (intro title card per clip with its coaching point). Big win for weekly review.
- [ ] **Field-diagram mode**: a tactics-board panel (top-down pitch, draggable player
      chips, same arrow/zone tools) for teaching schemes off-video; attachable to a clip.
- [ ] **Side-by-side compare**: two clips (or clip vs. pro example) playing in sync —
      "your touch vs. the model touch."
- [ ] **Better iPhone-friendly export**: WebCodecs-based mp4 (H.264) encode in Chrome so
      exports always play natively on iOS without Safari or conversion; faster-than-
      realtime export while at it.
- [ ] **Session builder**: pick clips into an ordered playlist with a per-clip question,
      run it as a guided session (auto decision-point flow), log his answers.

### Later
- [ ] Track multiple spotlights in one pass; track backwards from an anchor.
- [ ] Per-player trend dashboard: tag counts across games/projects (e.g. "scans before
      receiving" trending up), CSV export.
- [ ] Touch/iPad support (PWA manifest, touch-friendly drag handles) so review sessions
      can happen on the couch.
- [ ] Project bundles: zip of project JSON + exported clips for archiving a season.
- [ ] Optional smarter tracking (e.g. lightweight on-device model) if the SAD tracker
      proves insufficient on far camera angles — must stay offline and dependency-free
      (single-file constraint; could embed as base64 if ever needed).
- [ ] Voice-over recording on exports (mic + video mux) for narrated teaching clips.

### Explicitly not planned
- YouTube downloading (ToS) — screen recording is the supported path.
- Accounts, cloud sync, uploads of any kind.
- Build tooling / frameworks. It's one file on purpose.

## Architecture notes (for future sessions)

- **Everything is in `index.html`**: CSS → HTML → one `<script>` (~2000 lines, plain JS).
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

## Working agreements for future sessions

- Develop on the designated feature branch; run `tests/` smoke suite before pushing.
- Keep `index.html` self-contained — no external requests, no libraries.
- Update this file (feature checkboxes, decision log) as part of any feature commit.
- Preserve backward compatibility of the project JSON (`version` field exists for
  migrations if the schema must change).
