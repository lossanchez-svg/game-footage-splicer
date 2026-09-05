# Film Room — Product Plan & Roadmap

This is the source of truth for where the project is and where it's going.
**Keep it updated**: when a feature lands, check it off; when a decision is made, log it.

## ▶ Start here (next session)

You are picking up a working, fully-tested product. Before writing any code:

1. Read `CLAUDE.md` (conventions, test workflow) and this file top to bottom — especially
   the decision log, which records ten builds of tracker lessons learned the hard way.
2. **v4 "Lock-On" is SHIPPED (build `v4.0`): detection tracking is ON by default
   since 2026-08-25**, after the real-clip eval showed it beating the v3.7 template
   tracker on every clip of the parent's acceptance set (numbers in "v4 progress"
   and the decision log). The template tracker remains fully intact as the automatic
   fallback (no `lockon.js`, old browser) and behind the
   `localStorage["filmroom:lockonPath"] = "off"` switch; `run.js --path template`
   still measures it. Every future tracker change faces the same gate: beat or match
   `tests/realeval/baseline.json` on every clip or it does not ship. Two recorded
   open items: a real 40s clip for the end-to-end acceptance line (40s proven on
   synthetic `long.webm` only), and the occlusion clip's back half (an honest loss
   at 8s — candidates: multi-hypothesis carry-through, the v6 ball signal).
   **v5 "Reel Studio" is SHIPPED too (build `v5.0`, 2026-08-25)**: the player card,
   the season storyboard, the 16:9 master reel and 9:16 auto-reframed social cut
   rendered across games from the Games folder, and the sharing kit (YouTube words
   with matching chapters, coach email, one-page player site). Its acceptance status
   sits at the end of the v5 section — the one open measurement (occlusion clip's
   9:16 in-frame %) is bounded by the same v4 occlusion item above; `tests/realeval/
   reframe.js` re-measures it in one command. **v6 "Cutting Room" is SHIPPED as
   well (build `v6.0`, 2026-08-25)**: the ball rides the detection pass with honest
   coverage numbers, "✨ Find his moments" scans a game into a yes/no checklist,
   "✂ Tighten to the action?" proposes trims, the metadata socket exports the
   season as words-and-numbers and imports reel plans as drafts, and `AUTOPILOT.md`
   documents the opt-in E0 workflow with the app-measured edit-distance ledger.
   Three v6 gates are INSTRUMENTS awaiting the user's data (see the v6 acceptance
   status): ball accuracy needs hand-marked `ball` rings on the eval clips, and the
   finder-recall + auto-cut gates need one hand-broken-down game (a project with
   his saved clips) in `tests/realeval/clips/`. Nothing further is specced — the
   next epic is the user's call.
   **Audited 2026-09-05** (`docs/AUDIT-2026-09-05.md`): every suite green on fresh
   fixtures, and the default Follow press with the REAL model now has an end-to-end
   check in `tests/lockon.js` (body-shaped fixture → detection path holds his feet).
   The editing surface and its honest gaps (no slow-mo/ramps in exports, cuts only,
   no music) are tabulated there. **v9 "Less hand-holding" followed the same day**
   (see its section): the detection hunt carries on for 30 s with frame-wide
   same-kit uniqueness and records gaps, resumed runs join their reports, and
   "✨ Make his reel" drafts a reel in one press. **One open gate:** the carry-on
   tracker change needs `node tests/realeval/run.js --gate` on the user's real clips
   before it merges — the synthetic suites cannot stand in for that.
3. The single most important lesson from v2.5–v3.7: **measure before building.** Every
   fixture must be validated against real footage numbers (a tracking report or counted
   pixels from real frames) before any conclusion is drawn from it. Nine builds chased
   the wrong thing because fixtures put the ring on the player's middle when real users
   put it on his feet.

## ✅ Shipped epic — v2: The Grandma Test (intuitive-first UX + onboarding)

**Goal:** an 88-year-old grandmother who has never seen the app can open it and, with no
one helping, watch this week's film session with her grandson — and a first-time dad can
discover annotate → clip → export without reading the README. Judge every change by:
*"could Grandma figure this out with nobody in the room?"*

**Principles (apply to every workstream):**
- The next step is always **visible on screen**, never something to remember.
- **Plain words** over icons and jargon; full sentences in tooltips. Nothing user-facing
  says fps, In/Out, mux, keyframe, or normalized anything.
- **One obvious primary action** per screen state; advanced controls fold away.
- Big targets, readable text, gentle colors already exist — audit for AA contrast.
- Mistakes are cheap: destructive actions confirm or offer Undo; the app never fails
  silently (the drop-feedback fix is the model — copy that standard everywhere).

### ✅ Workstream A — guided first-run tour (do-based coach marks) — SHIPPED
Replace the auto-opening help modal with a step-by-step tour anchored to the real UI.
Each step is a small bubble pointing at one control, and it advances when the user
**does the thing**, not when they click "next":
1. "Tap here to open your game video" → advances when a video loads.
2. "Press play — or drag this bar to move through the game" → advances on first play/seek.
3. "Pick **Spotlight**, then tap your player on the video" → advances on first spotlight.
4. "Found a moment? **Start clip here** … **End clip here** … **Save clip**" → advances on
   first saved clip.
5. "Your clips live here — this is his library" (Clips tab) → tour complete.
Requirements: a "Skip tour" link on every bubble; completed/skipped state persists
(localStorage) and the tour never auto-returns; "Restart the tour" lives in Help; bubbles
reposition on resize and work on touch; non-target UI stays usable (dim, don't block).
Tests: a suite that walks the tour by doing the actions, verifies advancement, skip, and
never-again-after-completion.
**Shipped:** five coach marks (`#tourBubble` + a `pointer-events:none` `#tourRing` that dims
without blocking), each advancing only when the user does the thing — video loaded, first
play/scrub, first spotlight, first saved clip, Clips tab opened. Step 4 re-words itself as
Start → End → Save. Bubbles get out of the way of any dialog/export/decision overlay
(MutationObserver) and follow their control on resize. "Skip the tour" on every bubble;
`filmroom:tourDone` (legacy `filmroom:seenHelp` also counts) means it never auto-returns;
❓ Help has "↻ Restart the walkthrough". The help modal no longer auto-opens.
Verified by `tests/tour.js` (24 checks) including touch taps and a resize.

### ✅ Workstream B — real tooltips (hover + touch), first-use hints — SHIPPED
Native `title` attributes are invisible on iPad and slow on desktop. Build a lightweight
tooltip system (no dependencies):
- Source of truth: move every `title` into `data-tip`; render as a styled bubble on
  hover (~400ms delay) and on **long-press** for touch; large readable text.
- **Audit every control** so each has a plain-language tip that says what it does AND
  when you'd use it (e.g. Auto-track: "Follows the player you spotlighted so you don't
  have to move the ring by hand").
- One-time contextual hints (each shows once, tracked in localStorage): first tool
  selection → "Now tap or drag on the video"; first spotlight → "Scrub ahead — try
  🎯 Auto-track to make the ring follow him"; first saved clip → "It's in the Clips tab";
  first reel add → "Export one video, or Run session to watch it together".
Tests: tooltip appears on hover and on simulated long-press; one-time hints fire once
and never again after reload.
**Shipped:** every `title` is gone — controls carry `data-tip` and a `#tipBubble` renders it
after a 400ms hover or a 500ms long-press (the long press is swallowed, so reading a tip
never fires the button underneath). Copy audited across the whole app for "what it does
AND when you'd use it", in plain words. Four one-time hints (`filmroom:hint:*`): first
tool pick, first spotlight, first saved clip, first reel add — held back while the
walkthrough is running, since that already says what to do. Verified by `tests/tips.js`
(19 checks), which also audits *every* reachable control for a full-sentence, jargon-free tip.

### ✅ Workstream C — plain-language pass over every surface — SHIPPED
- Copy audit of all buttons/labels/toasts/modals. Keep layouts compact, but prefer words
  where they fit: e.g. "⟦ In / Out ⟧" → "Start clip / End clip"; "📸 Still" → "📸 Photo";
  "🎬 Export clip" → "🎬 Save video"; "fps" moves out of the transport bar into a small
  "Advanced" disclosure (default 30, note that iPhone is often 60). The 🔊/⚡ export mode
  picker gets plain names ("Best for iPhone" / "Keeps sound, slower").
- Every empty state states the single next action in one sentence (most exist — audit).
- Every toast is a full sentence a non-technical person understands.
Tests: screenshot pass over each tab/mode; smoke assertions updated for renamed labels.
**Shipped:** "Start clip here / End clip here", "📸 Photo", "🎬 Save video",
"🎬 Save as one video", "🎓 Watch together"; frame rate folded into an **Advanced**
disclosure as "pictures per second"; export modes renamed "Best for iPhone" /
"Keeps sound, slower". "Keyframe" and "playhead" are gone ("📍 Pin him here",
"Appears/Disappears here"), and a decision point is now simply a question you ask him.
Every toast rewritten as a full sentence that also says what to do next where there is
one; empty states name their single next action (including the Safari note about the
Games folder). Help and README rewritten to the same words. Verified by
`tests/plainwords.js` (20 checks): renames, the disclosure, a jargon sweep over every
visible surface, a toast-is-a-sentence check parsed out of the app's own source, and a
screenshot walk through every tab and mode.

### ✅ Workstream D — "Watch" front door for the family — SHIPPED
Grandma's real job is **watching**, not editing. When a project has a reel:
- On load, show a friendly banner/button: **"▶ This week's film session is ready —
  Start"** → launches the guided session (already mom-proof).
- The session screens get an XL type treatment (they're already simple; bump size,
  ensure every button is thumb-big).
Tests: banner appears only when a reel exists; starts the session; dismissible and stays
dismissed for that visit.
**Shipped:** a full-width banner above everything — "▶ This week's film session is ready"
with the reel title, clip count and rough length — appears the moment a game has clips
lined up, and its one primary button starts the guided session. "Not right now" hides it
for the visit; finishing a session hides it too; reopening the game offers it again.
Session screens got the XL treatment (26px headings, 28px questions, 56px-tall buttons,
17px inputs) so they read from a sofa. Verified by `tests/watch.js` (15 checks).

### ✅ Workstream E — comfort & accessibility — SHIPPED
- "Aa" text-size toggle (normal / large) persisted; large mode bumps base font and
  control padding app-wide.
- Contrast audit to WCAG AA on the dark theme; visible keyboard focus states.
- Longer toast duration in large mode.
Tests: toggle persists; spot-check computed font sizes.
**Shipped:** an **Aa** button in the top bar switches the whole app between normal and
large — base font 14→17px, buttons taller and wider, small print, tabs, tooltips, the
walkthrough bubble and the watch banner all scale — persisted in `filmroom:textSize`,
and toasts stay on screen 1.6× longer in large mode. Contrast: white-on-green primary
buttons were 3.4:1, so text now sits on a darker `--accent-btn` (#1a7f37, 4.5:1) while
`--accent` stays the bright brand green for borders and marks; placeholders pinned to a
passing grey. Keyboard focus shows a 3px `:focus-visible` ring on every control.
Verified by `tests/comfort.js` (21 checks) — including a real WCAG AA audit that walks
every visible text node on every screen (both text sizes, both tabs, Help, the
save-clip dialog, the watch banner, the walkthrough bubble and tooltips), computing the
effective background and the correct threshold for large vs normal text.

### ✅ Workstream F — friction backlog from real use — SHIPPED
- Deleting anything offers **Undo in the toast** (replace `confirm()` dialogs where the
  action is cheap to restore).
- "Play does nothing" when no video is open → point at Open, don't stay silent.
- Whole-video export confirm should state the expected duration in minutes.
- Safari on Mac: 📁 Games hides (correct) — the empty state should mention that the
  library needs Chrome/Edge on Mac so its absence isn't confusing.
**Shipped:** `toast()` grew an optional action button, and every delete (drawing,
question, clip, board, session-log entry, this week's list, a clip taken out of it) now
just happens and offers **↩ Undo** in its own message — no `confirm()` anywhere it is
cheap to restore. The Undo captures its own snapshot rather than popping the undo stack,
so it still restores *that* deletion after other edits. `needVideo()` backs every
transport/clip/export/photo/save control: with nothing open it names the button that
fixes it and pulses that button, instead of doing nothing. The whole-game export confirm
now states the length in minutes and points at the cheaper alternative. The Safari note
landed with the empty-state rewrite in workstream C. Verified by `tests/friction.js`
(26 checks).

**Definition of done for the epic:** all six workstreams merged with their tests, all
existing suites still green, README/help updated, and a fresh-eyes walkthrough
(screenshots at each step) attached to the PR description.
**Status: done.** All six workstreams shipped with their suites; the full suite runs
**251 checks green**. README and in-app help rewritten to the new words.
`tests/walkthrough.js` drives the entire first-time journey — cold open → walkthrough →
video → play → spotlight → mark → save → library → tooltip → this week's set → the
front door → session question → large text → delete-and-undo — writing
`tests/out/walk_*.png` at every step; that's the screenshot set for a PR description
(and it re-runs, so it never goes stale).

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
- **PWA (hosted, and live)**: manifest + service worker + icons; register only over
  http(s). **GitHub Pages is enabled and has deployed every merge to `main` since
  2026-08-18** — the app is served at
  `https://lossanchez-svg.github.io/game-footage-splicer/`. Open it on iPhone/iPad Safari
  → Share → Add to Home Screen. Fully offline afterwards; footage still never leaves the
  device. (The app shell is network-first since v2.9.1, so a returning visitor gets the
  newly deployed build rather than a cached one.)
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

### ✅ v1.5 — audio in fast mp4 exports (shipped)
Fast exports now carry the game audio, still without ever playing in real time:
- A pure-JS **mp4/mov audio demuxer** (`demuxMp4Audio`) walks the source container
  (iPhone video and ⌘⇧5 screen recordings are both AAC-in-mp4/mov), finds the `soun`
  track, parses `esds` → AudioSpecificConfig, and maps every AAC packet to its byte
  range and timestamp; packets for just the clip's range are read with coalesced
  `File.slice` reads (no full-file load, so hour-long Trace files are fine).
- The clip's packets are wrapped in a tiny audio-only mp4 (reusing `buildMp4`) and
  decoded via `decodeAudioData`; the export's audio timeline is then assembled
  **sample-exactly** from the video segment map — real silence under the title card and
  decision freezes — and AAC-encoded with `AudioEncoder`.
- `buildMp4` grew an AAC track (`mp4a`/`esds`, run-length `stts`), so the writer can
  emit video-only, audio-only (the decode wrapper), or muxed two-track files.
- Fallbacks, each with a clear toast: no AAC in the source (WebM) → silent; browser
  can't AAC-encode → bit-exact packet **passthrough** when the timeline has no
  card/freezes, else silent; ranges >10 min → passthrough or silent (memory guard).
- Verified in `tests/muxer.js` with real codec data: real H.264 + real AAC muxed by the
  app, **round-tripped through the app's own demuxer** (packet count, rate, channels,
  timestamps), then ffmpeg-probed (both streams) and fully decoded clean.

### ✅ v1.6 — highlight reel builder (shipped)
The weekly TV package: tick clips into a reel (➕ Reel on each clip), order them with
↑/↓, give the reel a title, and export **one stitched mp4** — an opening reel card
(title + clip count), then each clip with its own coaching card and decision-point
freezes, game audio carried throughout with silence under every card. Implementation:
`exportFast` refactored into `exportProgram(items, …)` — single clips and reels share
one render path — and `buildFastAudio` now decodes audio **per media segment**, so a
reel whose clips are scattered across an hour-long game never holds more than one
clip's PCM in memory. Reel selection/order/title persist in the project (`project.reel`,
`project.reelTitle`). Reel export requires the ⚡ WebCodecs path (realtime fallback would
take the reel's full length; a toast says so on unsupported browsers). Verified in
`tests/fastexport.js`: two clips + title → one mp4 with exactly the expected frame count
(intro 90 + 2×card 84 + media 105 + freeze 96 = 459) and title-bearing filename.

### ✅ v1.7 — guided session builder (shipped)
The interactive sibling of the reel, runnable by anyone (mom-proof by design):
**🎓 Run session** plays the reel list as an in-app Q&A. For each clip the **question
comes first** (per-clip "Ask him" field on the clip, sensible default otherwise) — he
commits to an answer out loud, optionally typed in his words — then the clip plays
(decision points inside still fire), with *watch again* one tap away. The session ends
with the recap the Coach tab preaches: **2 things done well + 1 to work on, in his
words**. Everything lands in a **📓 session log** (persisted in the project, shown in
the Clips tab) with per-session **notes file export** — ready to text to a coach.
Ending early keeps any captured answers. Also fixed for real: autosave now flushes on
page unload, so a tab closed seconds after finishing a session (or any edit) can't lose
the last write — this closed a latent race the debounced autosave always had.
Verified in `tests/session.js` (16 checks): question-before-clip ordering, auto-pause
into the answer screen, custom vs default questions, recap capture, log rendering,
notes-file content, and reload persistence.

### ✅ v1.8 — tactics board (shipped)
**🗒 Board** (top bar) swaps the stage to a top-down pitch for teaching schemes
off-video. All the existing tools work on it — spotlight places a **player chip**
(drag to move, double-click to rename), arrows/zones/pen/text draw exactly as on video.
Format presets (5v5/7v7/9v9/11v11) seed both teams in formation; **⟲ Line up** re-seeds
players while keeping drawings. Multiple named boards per project; each clip's **🗒**
button creates/opens a board linked to that clip (teach the scheme behind the moment).
Boards export as **PNG** (1600px) and persist in the project. Undo snapshots were
extended to cover boards — and, fixing a latent gap, reel/session state too.
Verified by `tests/board.js` (14 checks): seeding counts, chip place/drag/rename,
drawing, format switching, clip linking, PNG export, reload persistence.

### ✅ v1.9 — side-by-side compare (shipped)
**⚖ Compare** (top bar, or the ⚖ button on any clip) plays two clips in lockstep:
side A ("his clip") is the master clock, side B ("the model") — another clip from the
library or an **outside video file** (e.g. a screen-recorded pro example) — is re-synced
to A every frame (drift measured at ~0s). The pair **loops over A's range**, both sides
frame-step and speed-change together, and an **align nudge** (±0.1s) lines the key
moments up. Annotations render on each side at its own time; **📸 Still** exports a
labeled composite PNG of both panes. Panes stack vertically on narrow screens.
Verified by `tests/compare.js` (13 checks): sync drift, pair looping, dual frame-step,
nudge, file-as-model, composite PNG, mode enter/exit.

### ✅ v1.10 — Photos-first intake + game-film library (shipped)
First real-world-use feedback (Photos-app drags silently failing) turned into a
device-aware intake flow:
- **Empty state is now a launcher**: a big primary button that reads **"Open from
  Photos"** on iPhone/iPad (the file input there opens Apple's native Photos picker,
  albums included — the best possible path, no code needed beyond leading with it) and
  "Open a video…" elsewhere, plus **📁 My games**.
- **📁 Games library (Mac Chrome/Edge)**: File System Access API. Point Film Room at a
  game-film folder once (directory handle persisted in IndexedDB, permission re-granted
  via a Reconnect button after browser restarts); the app lists the folder's videos
  newest-first with a 📝 has-work marker (matched against the autosave key) and opens
  any game in one click. An iCloud Drive folder makes the library cross-device. Hidden
  where the API doesn't exist (Safari, iOS — iOS has the native picker instead).
- Failed drops explain themselves (Photos-app file promises never reach browsers); docs
  restructured per device. Verified by `tests/library.js` (8 checks) with a stubbed
  `showDirectoryPicker` serving real video bytes: listing/filtering/ordering, one-click
  open, has-work marker, hidden-when-unsupported.

### ✅ v2 — The Grandma Test (shipped)
Six workstreams, each with its own suite (`tour`, `tips`, `plainwords`, `watch`,
`comfort`, `friction`, plus the `walkthrough` screenshot pass): a do-based first-run
walkthrough that advances only when the user does the thing; real `data-tip` tooltips on
hover and long-press with four one-time hints; a plain-language pass that removed
In/Out, fps, keyframes and playheads from every surface (and a test that keeps them
out); a "this week's film session is ready" front door with XL session screens; an **Aa**
comfort mode plus a computed-contrast WCAG AA audit and visible focus rings; and a
friction pass where every delete is undoable from its own message and no control ever
fails silently. Details and rationale in the epic section above.

### ✅ v2.1 — cross-device continuity (shipped)
Opening a game from **📁 Games** now also saves its clips and drawings into that folder
as `<video>.filmroom.json`, right next to the video. Keep the folder in iCloud Drive and
the same game opened on another computer picks the work up on its own — no Save/Load
project step. Details:
- The folder is requested with **readwrite** now; the write permission is actually
  granted at the moment a game is opened from the list, because that click is the only
  user gesture a browser will accept it from. A refusal is silent and everything falls
  back to the browser's own autosave.
- Writes are debounced ~2.5s on top of the existing autosave (folder writes hit iCloud;
  one per keystroke would thrash), serialised against each other, and flushed on
  `visibilitychange → hidden` — the one unload-ish hook that can still finish async work.
- Every project carries `savedAt`. On open, whichever copy is newer wins, and the toast
  says which one it used ("where you left off" vs "newer work from your Games folder"),
  so a stale folder copy can never silently eat today's work.
- The library list marks games as **📝 has work** (this browser) or **☁︎ has work from
  another device** (a sidecar in the folder), which is what makes the feature legible on
  a machine that has never opened that game.
- A **☁︎ Saving to your Games folder** indicator appears in the top bar while it is on.
Verified by `tests/continuity.js` (22 checks) with a writable stub folder that survives
across browser contexts, so "another device" is a fresh browser with empty storage
looking at the same folder.

### ✅ v2.2 — progress dashboard (shipped)
**📈 Progress** in the top bar reads *every* project this browser knows about — plus any
`.filmroom.json` sidecars in the Games folder, so work done on another computer counts —
and answers the question a season actually raises: is he getting better at the things you
keep talking about? Nothing new is recorded; it is the clips and tags already saved,
counted.
- **Headline numbers** as stat tiles (games broken down, moments saved, share that are
  strengths, sessions watched together) — not a chart, because the story is four numbers.
- **Game by game**: one stacked bar per game in *game-date* order (`videoDate`, captured
  from the file's own timestamp on open, so the season reads chronologically rather than
  in the order you happened to edit).
- **What comes up most**: the top 8 labels, stacked by strength / work-on / teachable.
- **What is changing**: the real trend — his early games vs his recent ones, compared as
  *per-game rates* (the halves rarely hold the same number of games), filtered to tags
  with enough occurrences to mean something and a move big enough not to be noise. Stated
  in plain sentences rather than a chart, since that is what a parent actually reads.
- **Filters** (position, format) in one row scoping everything at once, and a **⬇
  Spreadsheet** CSV export — one row per moment, ratings spelled out, RFC-correct quoting.
- Charting discipline: the app's existing status colours (strength/work-on/teachable),
  a legend with icons so identity is never colour-alone, every value printed as text
  beside its bar (the tooltip adds detail, it never holds the only copy), 2px surface
  gaps instead of borders, bars capped at 18px.
Verified by `tests/trends.js` (28 checks) over a synthetic six-game season; the dashboard
is also now part of the WCAG AA contrast sweep in `tests/comfort.js`.

### ✅ v2.3 — session insights (shipped)
The session log had been accumulating his answers since v1.7 and nothing ever read them
back. **📈 Progress** now ends with two sections built from them:
- **In his own words** — how many questions he has been asked across every session and
  how many he answered in writing, then the flagship: **"asked before, and again since"**.
  Questions are grouped by their own text (normalised for case and punctuation) and any
  question answered in **two or more** sessions shows both answers in date order, oldest
  first, newest marked *most recent*. Read top to bottom, that is his game-reading
  changing in his own words — which is the entire reason the session builder asks before
  it shows him the film. A question answered once is never dressed up as a trend; when
  there is no repeat yet, the section says plainly what to do to create one.
- **What you said to work on** — the closing line of every session, newest first, with
  what went well riding along. Repeats are the signal, and the copy says so.
- Unwritten answers are described as *talked out loud — not lost*, so the percentage
  never reads as him having failed to answer.
- The position/format filter scopes these too (entries are matched back to their clip),
  so "Showing: Striker" narrows what he was asked, not just the bars above.
Verified by `tests/insights.js` (17 checks), including that his free text is escaped
rather than rendered, and the styling is inside the WCAG AA sweep in `tests/comfort.js`.

### ✅ v2.4 — voice-over on exports (shipped)
**🎤** on any clip records you talking over it; the recording is mixed into the exported
mp4 with the game sound ducked to 28% underneath, so a clip coaches on its own when
nobody is sitting next to him.
- Recording plays the clip from its start while it captures, so what you say lines up
  with what he sees; it stops itself at the end of the clip.
- **Where it lives:** IndexedDB, keyed by clip id — deliberately *not* the project JSON.
  Audio would blow the localStorage quota, and an autosave silently failing is the worst
  outcome available here. The trade-off is that a voice-over stays on the computer it was
  recorded on, which the UI states rather than hides.
- **Alignment:** the voice is laid against the clip's own timeline, so a decision-point
  freeze cuts the narration exactly where it cuts the picture and the two resume together
  on the other side — rather than the voice running on and desyncing for the rest of the
  clip.
- `buildFastAudio` now proceeds when the source has **no** audio at all (a voice-over on
  silent footage still produces a soundtrack), skips the bit-exact passthrough path when a
  voice-over is present (mixing requires encoding), and resamples each recording to the
  export's rate via the OfflineAudioContext it is decoded with.
- The slower "Keeps sound" exporter records a screen pass and cannot mix, so choosing it
  with a voice-over present says so instead of quietly dropping it.
Verified by `tests/voice.js` (22 checks) with a stubbed microphone emitting a real WAV.

### ✅ v2.5 — multi-spotlight tracking, and the four-second trap (shipped)
**Reported from real use: "I was trying to use the auto-tracking feature, but it wasn't
following the player."** The cause was not the matcher — it was how far it was told to go.
`autoTrack` ran from the playhead to the spotlight's `tEnd`, and a freshly placed ring
defaults to `tStart + 4s`. So pressing Auto-track on a new ring followed the player for
**four seconds and stopped**, and pressing it after scrubbing past that point did nothing
but flash a toast describing a four-step ritual. Both are indistinguishable from a broken
tracker. Every tracking test passed throughout, because every test performed the ritual
first — a textbook case of a suite testing the path its author already knew.
- **Fixed:** auto-track now follows from the playhead *until it loses him*, bounded by the
  marked clip's out-point if there is one, else 25 seconds, and it extends the spotlight's
  end to wherever it actually got — so the ring stays on screen for the path it followed.
  An explicitly-set end (the user pressed "Disappears here") is still respected.
- **Multi-spotlight:** `autoTrack` now takes a list. Seeking and decoding each frame is
  what costs, so N players cost barely more than one; matching state (template, anchor,
  velocity, coast/drift counters, patch size) is per-spot, and the working resolution is
  driven by the *smallest* ring so the furthest player still has pixels. **🎯 Follow
  everyone on screen** appears once two or more rings are live at the playhead.
- Verified by `tests/multitrack.js` (21 checks) on a new `two.webm` fixture whose two
  balls run straight through each other. Both are tracked in one pass, each stays on its
  own player through the crossing, and neither collapses onto the other. Tracking one of
  them *alone* in the same fixture gives the identical error at the crossing, so following
  several at once costs nothing in accuracy. `tracking.js` and `hardtrack.js` report the
  same errors as before the refactor (0.004–0.005), confirming matching is untouched.

### ✅ v2.6 — tracking backwards from an anchor (shipped)
**⏪ Where he came from** works the tracker backwards. The moment you can *find* in the
film is usually the moment the ball arrives; the moment worth coaching is the run he made
to get there. Put the ring on him at the obvious moment and this fills in the run behind
it.
- `autoTrack(spots, dir)` — the matcher never cared which way time runs, only the
  bookkeeping did. Backwards steps `t -= dt`, bounds at the marked clip's **In** point,
  else 25 seconds, else the start of the video; the kept-keys split works from
  `min/max(t0, limit)` in either direction; the path is reversed before thinning so keys
  stay in time order and the ring glides; and it stretches the spotlight's **tStart**
  backwards rather than its `tEnd`, so the ring is on screen for the run it now shows.
- Fixed a latent trap while here: whether an end was "explicitly set" was inferred from
  `(tEnd - tStart) !== DEFAULT_DUR`, which a backwards track would silently invalidate —
  stretching tStart made the arithmetic read as deliberate. Pressing **Disappears here**
  now records `endSet` on the spotlight, so intent is stored rather than guessed.
- Verified in `tests/multitrack.js`: works back from an anchor at 6s to the start of the
  video, lands within 0.001–0.005 of the ball at three checkpoints, stores keys in time
  order, never runs past the anchor, and explains itself when there is nothing behind the
  anchor to work through.

### ✅ v2.7 — season bundles (shipped)
**📦 Keep this game** packs everything one game produced into a single zip: the project
itself, `moments.csv`, the session notes as plain text, the tactics boards as PNGs, your
**voice-overs** — which otherwise exist only in the browser that recorded them, so the
bundle is the only way to move or keep them — and, if asked for, a video of every clip.
A `README.txt` explains each folder and how to get the work back, because an archive
found in three years has to explain itself.
- **Hand-rolled zip writer**, in the same spirit as the mp4 muxer: entries are **stored**
  (never deflated — mp4/png/webm are already compressed and the text is a rounding error),
  CRC-32 per entry, UTF-8 names. File blobs go into the final `Blob` **by reference**, so
  only the file being checksummed is ever in memory and a bundle of a season's clips does
  not have to fit in RAM at once.
- No ZIP64, so the archive is capped just under 4GB and **says so** rather than writing
  something that unzips as garbage.
- `exportProgram` gained `opts.collect`: it hands back the mp4 instead of downloading it,
  and leaves the busy overlay to the bundle so progress reads as one job rather than
  flashing per clip.
- Videos are **opt-in** and the offer states the cost in minutes — the difference between
  a file you can email and one that takes twenty minutes to build.
Verified by `tests/bundle.js` (22 checks), which opens the result with the **real `unzip`
binary** (`-l` and `-t`, so listing *and* every checksum), extracts it, and loads the
packed project back into the app. A zip only this app could read would be worthless.

### ✅ v2.8 — tactics boards as cards inside the video (shipped)
A clip with a 🗒 board linked to it now shows that board as a full-frame card in any video
it appears in — single clip export or stitched reel.
- **Placed after the clip, never before.** The board explains the moment you have just
  watched; putting it first would answer the question before he has had a chance to,
  which is the opposite of what the session builder is for.
- Rendered at the pitch's own **105:68** aspect and centred rather than stretched to 16:9,
  with the clip's title above it so a viewer knows which moment it belongs to.
- Uses the same `pushCardFrames()` helper as the title cards, so its stretch of the audio
  timeline is a silence segment by construction — no game audio over a still picture.
- No setting to find: a board only appears if you made one for that clip, so the feature
  is opt-in by construction.
Verified in `tests/fastexport.js` by exporting the **same clip before and after** attaching
a board and asserting the difference is exactly one card (114 → 210 frames, +96 = 3.2s at
30fps) — the board's own contribution rather than arithmetic about card lengths.
Screenshot: `docs/walkthrough/16_board_card.png`.

### ✅ v2.9 — the tracker on real footage (shipped)
**The standing "blocked on real footage" item finally got its evidence:** a screen
recording of a real sideline clip where the ring left Jude (#81) and ended up on empty
grass, plus the user's note that *"it did drift to grass"*. Measured from that recording:
the player is **0.7% of the frame wide**, the default ring is ~3× wider than his body,
and the old working-resolution rule `clamp(16/r, 480, 960)` handed a **default** ring the
**lowest** resolution — leaving him **3.5 × 13 pixels**, with the template **97% grass**.
Three real defects, found by reproducing it in a fixture (`tests/fixtures/small.webm`:
8×20 player, mown striped grass, look-alike team-mates) before changing any code:
1. **The ring says where he is, not how big he is.** The patch is now *chosen*: at the
   anchor frame several sizes are tried, and each is scored by sweeping the surrounding
   field the way the matcher will and asking how well the field can impersonate it. The
   most distinguishable size wins. A first metric that probed a few fixed points was
   thrown out — it rated every candidate "distinct" because it never found the
   stripe-aligned impostors the real search settles on.
2. **A look-alike team-mate could silently take the ring.** In the same kit, players are
   identical to a template matcher, so a crossing team-mate scored equally and the ring
   changed player — the reproduction followed the *wrong* player backwards for 4 seconds
   at a reported lock of 0.9+. `bestMatch` now subtracts a distance penalty from the
   *choice* (raw score still reported and thresholded), so an impostor at the edge of the
   window must be substantially better, not merely equal.
3. **A patch can be too small to match anything.** Shrinking sometimes lands entirely
   inside one flat-coloured thing; a template with no internal variance correlates with
   nothing and scores 0 against the player himself. Candidates below an RMS-contrast
   floor are now rejected, with the drawn ring as the fallback. (Found by this change
   breaking `multitrack.js` — the second player died after 6 samples.)
Also: the working-resolution floor is raised (960 where the source allows), the search
radius is frame-relative rather than tied to patch size, and when even the tightest patch
barely stands out the finish message says so and points at **Ring −**.
`tracking.js` and `hardtrack.js` report unchanged errors (0.002–0.004), so the v1.4 tuning
is intact. New `tests/smalltrack.js` (8 checks) is the regression: err 0.373 → **0.002**.

### ✅ v2.9.1 — the update that never arrived (shipped)
A retest of the v2.9 tracker fix reported the same failure. The tracker was not the
reason: **`sw.js` served the app cache-first**, refreshing in the background, so every
deploy reached a returning visitor **one visit late**. Anyone testing a fix ran the code
from before it, saw the same bug, and reasonably concluded the fix had not worked. This is
the worst possible failure mode for a hosted single-file app that gets iterated on.
- The app shell (`/` and `/index.html`) is now **network-first**, with the cache as the
  offline fallback; everything else stays cache-first. Cache name bumped so the old
  worker is replaced.
- A **build stamp** (`v2.9`) sits next to the logo in the top bar, so any screenshot or
  screen recording answers "which build is this?" without anyone having to guess. Also on
  `window.__filmroom.build`.
- **Note for the next report:** the previously-installed worker still serves one stale
  load before the new one takes over, so a single hard reload is needed once; after that
  it self-corrects.
Also added `tests/fixtures/pan.webm` and four checks in `smalltrack.js`: a **panning
camera**, where the grass streams past while the player drifts slowly in frame — the case
where a grass-heavy template would follow the field. The v2.9 tracker holds it at err
0.005, so panning is not a remaining failure mode.

### ✅ v2.9.2 — measure it instead of guessing (shipped)
A third report, with the build stamp confirming `v2.9` was actually running, said the ring
still leaves the player. Three rounds have now been spent inferring the cause from frames
of a cropped screen recording, and each round produced a plausible hypothesis that the
reproduction fixture then refused to confirm. That is the wrong instrument.
- **🩺 Save tracking report** on the spotlight panel writes
  `filmroom-tracking-report.json` after any auto-track run: build stamp, video dimensions
  and duration, the working resolution the pass actually used, direction and start time,
  and per spotlight the ring radius, the chosen patch half-size, the distinctiveness score
  that choice was based on, the search radius, and where the pass was bounded. The result
  block adds, per sample, the match score, whether it was coasting through an occlusion,
  the drift from prediction, the position, and the velocity.
- Nothing about the footage leaves the machine — the report is numbers about the pass, and
  it downloads like any other file.
- The build stamp is `v2.9.2`, so a report identifies itself.
Also `tests/fixtures/trees.webm` (a high-contrast canopy above a small player, the case
the frames suggested) and five checks in `smalltrack.js` — four on the tree line, one that
a report is offered after a run. The tree-line case **passes** at err 0.005–0.010, which is
why the shape-mismatch hypothesis was not shipped as a fix: it is unconfirmed, and a
speculative change to the matcher would make the next report harder to read, not easier.

### ✅ v2.9.4 — what the report said, and what it cost (shipped)
The report came back and settled it. `distinct: 0.489` — pickPatch had **measured**
that the field around him could impersonate the template at **0.511** — and the loop
went on accepting anything over a hardcoded `ACCEPT = 0.45`. The bar sat *below* the
impostor. Everything after that follows: 126 samples, `lost: false`, a cheerful finish
message, and the ring parked below the bottom edge of the picture (y up to **1.026**)
for the last 2.6 seconds. Four things were wrong, each now fixed against a number:
- **The accept bar is derived, not declared.** `x.accept = clamp(bg + 0.12, 0.45, 0.80)`
  where `bg` is the impostor score pickPatch already measured. On this footage the bar
  becomes 0.631; on easy footage `bg` is small and it stays at the old floor, which is
  why every existing fixture is unmoved.
- **The anchor guard was asleep.** It is the one check meant to catch "this is a
  different player", and across all 126 samples the drift counter never left **0** — it
  fires below a fixed 0.1, and a template made mostly of grass beats 0.1 on any grass.
  Its floor now comes from `bg` too.
- **A coast was a licence to teleport.** Coasting doubles the search window, correctly;
  one frame later the ring jumped **99px** onto someone else at a healthy-looking 0.854
  and the adaptive template simply became that player. A leap past the normal window now
  has to satisfy the frozen anchor *there and then*.
- **Off the frame is not a place he can be.** `nccAt` clamps its reads, so sampling past
  the edge re-reads the last row of pixels — a smear that correlates with itself
  beautifully. The search window is now clipped to the picture.
Also, replaying the report against the new bar showed the bar **alone** would not have
saved that run (only 15 of 126 samples fall below it, never 6 in a row) — which is why
the anchor and teleport guards are here rather than a single tuning change.

**And the fixtures were the reason three rounds failed.** Measured: `small` 0.812,
`pan` 0.869, `trees` 0.742, `exit` 0.799, all matching at 0.96+. The real footage was
0.489, matching in the 0.6-0.8 band. Every reproduction attempt had been built to a
guess about the mechanism instead of to the measurement. `tests/fixtures/faint.webm` is
built to the number — muddy 5x13 smudges on noisy textured grass, largest candidate
patch scoring **0.43** — and it reproduced the failure on the first run: err 0.172 at
t=5, 0.446 at t=7, reported as a clean run. Strengthening the motion prior (the
near-bias goes linear in distance, so motion has a say near the centre of the window,
not only at its rim) and slowing velocity adaptation (0.75/0.25, so a crossing player
cannot overturn seconds of held direction in two frames) takes that to **0.005 at t=5**
and 0.162 at t=7, with every other suite error unchanged or better.

**Known gap, recorded rather than hidden:** in `faint.webm` a third look-alike drifting
at walking pace crosses at ~t=5.2, and the ring can settle on the slow one and stop —
err 0.162 at t=7, down from 0.446 but not right. Fixing it needs the tracker to
distrust a match whose motion contradicts a velocity held for seconds. `smalltrack.js`
holds the current bound so a regression is visible and a real fix just passes.

The report now also carries the anchor score, the bar each sample was held to, any
rejection reason, and the **full patch-candidate sweep** — the one number still missing
from the first report was what the smaller patches would have scored.

### ✅ v2.9.5 — match his shape, not a square of ground (shipped)
From the user, and correct: *"there will always be look-alikes since teams wear the
same uniforms and players will have similar characteristics — you may want to look at
the entire body of the player."* Colour cannot separate two players in the same kit, so
shape is the only thing left, and the tracker was sampling a **square** centred on the
ring. A square is wrong twice over: fit his width and it misses his body, fit his height
and it fills with the ground either side of him. On the footage that failed, a 57x57
square around a player roughly 10x26 pixels was **92% field**.
- The patch is now a **box** — half-width, half-height and a vertical offset — and it is
  **fitted to him**, not guessed. Field colour is taken from a ring of ground well
  outside him, every nearby pixel that differs from it is marked, and his extent is
  grown from where the ring was dropped, tolerating a gap or two (shorts and socks in a
  lighter colour break a player in half). If nothing coherent is there, the old square
  ladder still decides.
- The box carries **twice his measured size**. This was the part that mattered and it was
  not obvious: a skin-tight body box lost the player exactly as a square did (err 0.405
  at t=7), because a template holding only the player has nothing around it to hold
  position with and slides onto the next player in the same kit. The same shape with room
  around it held to **0.002**. Margin x2.5 breaks two other clips, so 2.0 is a measured
  optimum rather than a trend.
- **Distinctiveness is not what chooses it.** That measure is size-biased — a smaller
  patch always separates from grass better — so it would veto any box cut to a whole
  player. It still sets the accept bar; it no longer picks the shape.

New `tests/fixtures/body.webm`: a player with a head, a torso and two legs that scissor
as he runs, plus a look-alike in the same kit crossing him at the same depth. Every other
fixture's player is a solid rectangle, which has no stance, no legs and no gap — the
wrong instrument entirely for this question. With a square template it fails at err 0.142
(t=5) and 0.403 (t=7); with the fitted box, **0.005 and 0.002**.

This also closed the gap left open one build earlier: the walking-pace look-alike in
`faint.webm` went from err 0.446 to **0.004**. Suite: 428 checks green. The two
`multitrack` crossing errors moved from 0.003/0.001 to 0.019/0.019 — still well inside
tolerance, and the only numbers anywhere that got worse.

### ✅ v2.9.6 — "it follows him for a second, then stops" (shipped)
Reported straight after v2.9.5 went live. **Reproduced and fixed: a clip out-point
silently bounded every auto-track run.** Mark a moment with **End clip here** at 0:01 —
which is the ordinary way anyone saves a clip — and from then on every "Follow him from
here" stopped at 0:01, reporting a cheerful *"Followed him for 1.0 seconds"*. That is the
same sentence the tracker prints on a successful run, so there was no way to tell a
boundary nobody could see from a tracker that had given up. This is the four-second trap
of v2.5 wearing a different hat, and it is the second time an invisible bound has been
mistaken for a broken tracker.
- "Follow him from here" means follow him. Only an end set **on this spotlight** may stop
  it early now; clip in/out marks no longer bound it at all.
- When a run does end before the clip does, the finish message says **why** and what to
  do — the spotlight's own end, or the 25-second-per-go cap.
- `trackLimitFor` returns a reason alongside the time, and the reason is in the report as
  `stopBecause`, so a short run explains itself without anyone having to guess.

Two further defects found while chasing this, both real, both fixed, and both — stated
plainly — **behaviour-neutral on all eight fixtures**, so neither is evidenced as the
thing the user hit:
- **A runaway outline fit.** `fitPlayer` walked out to 90px looking for the edge of him,
  and on a crowded pitch him, the next player, a shadow and the far sideline are one
  connected blob, so it could return a box 365px across. A walk that never reaches open
  ground now refuses to answer, and the square ladder decides instead. `crowd.webm`
  covers it.
- **Cumulative drift against an unreachable floor.** The anchor guard incremented below
  `bg*0.8` but only reset above a *higher* `bg+0.05`, so a run hovering between the two
  never cleared its counter and hit the limit within a second however well it was
  matching. Drift is now strictly consecutive, its floor is calibrated from what the
  anchor actually achieves over the first second, and `MAX_COAST` goes 5 → 10 so a player
  behind someone else for a second is not given up on.
Also measured and **rejected**: warming up the *accept* bar the same way. It made
`dim.webm` markedly worse (err 0.004 → 0.190), because on hard footage a high bar is
doing useful work — it refuses bad matches and coasts on prediction instead. The accept
bar keeps its impostor-derived value.

Suite: 432 checks green.

### ✅ v3.0 — track by agreement, not by one chosen template (shipped)
The v2.9.6 report settled the immediate failure and condemned the whole approach. It
chose a box **33x79px centred 18px above the ring** — for a player about 10x26px, on a
park pitch, which makes it mostly tree canopy. It won because distinctiveness *rewarded*
it: canopy stands out from grass far better than a player does, scoring **0.725** against
the best square's 0.522. It then matched nothing at all (0.32–0.54 against a bar of 0.45),
lost him at **0.5s** and gave up. That is what "it follows him for a second and stops"
was, and it was a regression introduced by v2.9.5's guessed body shapes.

That is three separate attempts to find a single measure that predicts whether a patch
will track — patch size, then body shape, then distinctiveness — and each was wrong on
real footage. The lesson is not that the fourth measure will be right. **No single
template chosen up front can be relied on, so nothing is chosen.**

- **An ensemble.** Up to three templates cut differently from the same player — his
  measured outline, a tight square, a wider square carrying his surroundings — run
  together. They cost little: seeking and decoding the frame is what the pass spends its
  time on, the same reason a second spotlight is nearly free.
- **Each proves itself before the run.** Step one frame and see which can actually find
  him again; any that cannot are dropped, and the score is in the report. This is the
  question distinctiveness was standing in for, asked directly.
- **They track independently.** Each keeps its own position and velocity. Sharing an
  averaged centre was tried and was worse — one drifting template moved the shared
  centre, which dragged the others' next search after it, and all three walked onto the
  same wrong player *in perfect agreement* (`body.webm`, err 0.403 at 98% agreement).
- **The ring goes where they agree**, weighted by how far each is past its own bar and by
  how reliable it has proved. A plain head-count let two weak squares outvote the
  outline-cut template at a crossing.
- **When they split, motion decides.** A player carries on doing roughly what he was
  doing; a look-alike crossing the other way does not. That is the one difference no
  amount of appearance-matching can see, and with identical kit it is all there is. The
  continuity weight was swept: 1.0 beats 0.45 and 0.7 on every fixture.
- **Templates that fall behind rejoin.** Outvoted for a second solid, one is put back
  where the others agree he is and re-cut from how he looks now — which is also how the
  ensemble copes with the angle, the scale or the light changing mid-clip.
- **Agreement is reported, and said out loud.** It drops exactly where a person watching
  would say "I am not sure that is still him", so the finish message now says how long it
  was unsure, and the report carries per-sample confidence.

Measured across every fixture (err at t=1/3/5/7):

| clip | v2.9.6 | v3.0 |
| --- | --- | --- |
| `body` same-kit look-alike | 0.006 0.003 **0.141 0.403** | 0.006 0.003 **0.005 0.002** |
| `faint` walking-pace decoy | 0.004 0.003 0.037 **0.162** | 0.004 0.003 **0.004 0.008** |
| `crowd` five packed players | 0.062 0.134 0.108 **0.151** | 0.062 **0.008 0.047 0.088** |
| `dim`, `small`, `trees`, `pan` | 0.001–0.009 | 0.002–0.007, unchanged or better |
| `exit` runs out of shot | lost at 4.625s | lost at 4.625s |

**Not proven:** `canopy.webm` was built from the real report to reproduce the guessed-box
failure and does not — the outline fit succeeds there, so the guessed ladder never ran.
The guessed ladder is gone entirely, so that failure cannot recur, but the fix for the
user's clip is reasoned from their report rather than reproduced in a fixture.

Suite: 442 checks green.

### ✅ v3.1 — the template was never mostly the player (shipped)
Third report, and the three of them together say one thing. Every run's **first
frame-to-frame match** was 0.62, 0.538, 0.62 — where a real lock on the synthetic clips
is 0.93–0.98. A template that barely resembles itself one frame later is not a template
of a player; it is a template of grass, team-mates and tree line that happen to sit near
him, all moving differently. The anchor score then falls from 0.62 to about 0.2 within
two seconds while the adaptive templates report 0.9, because they re-learn whatever they
are sitting on. And on all three runs `patchTried` contained **no measured outline at
all**, so the ensemble was squares of mostly-not-him every time.
- **The outline fit now measures his width and bounds his height from it.** It used to
  demand open ground in every direction before answering, and on a park pitch — head in
  a tree line, fence, parked cars — it never could. Sideways there *is* grass either side
  of a player, so that measurement is sound; a person is about three times as tall as
  wide, which is a fact about people rather than a guess about this clip.
- **Selection is by peak-to-sidelobe margin, not distinctiveness.** Candidates are all
  built and all probed one frame on, scored by how much better they match him than the
  best impostor nearby. Raw next-frame score alone was tried and is biased toward tiny
  crops (they match themselves at 0.95 and everything else too, which put a 13x13 crop in
  charge and lost three clips); distinctiveness is biased toward whatever holds the most
  contrast. A peak is what a tracker actually needs and neither proxy could see it.
- **The ensemble is chosen for spread, not rank.** Three candidates ranked by one number
  are three near-identical crops that fail together and agree while doing it. Each further
  member must differ in area by half again, and the measured outline keeps a seat whenever
  it is usable at all.
- **Full resolution.** `20/rMin` asked for "enough pixels for a ring this size", which
  assumes the ring is sized to the player — exactly what is not true in the failing case.
  A default ring on a distant player asked for 571px and got 960 from a 1280 source,
  discarding a quarter of the linear detail on a subject ten pixels wide.
- **It says when it cannot get hold of him.** Whether a lock is possible is now measured,
  so a weak best-peak produces a message naming the fix — make the ring sit on him rather
  than around him — instead of a duration that reads as a broken tracker.

| clip | v3.0 | v3.1 |
| --- | --- | --- |
| `canopy` tree line + four players | 0.066 0.039 0.078 | **0.003 0.037 0.079** |
| `dim` busy ground | 0.005 0.005 0.004 | **0.002 0.008 0.002** |
| `crowd` five packed | 0.008 0.047 0.088 | 0.008 0.046 0.088 |
| `body`, `small`, `trees`, `pan` | 0.002–0.007 | 0.002–0.008 |
| `faint` late walking-pace decoy | **0.004 / 0.008** | **0.039 / 0.163** ← regressed |

**Reopened regression, stated rather than hidden:** `faint.webm`'s late look-alike goes
from 0.008 back to 0.163 — the level it sat at two builds ago. That clip is solid blocks
with no body structure and a same-coloured decoy at walking pace, and the new selection
costs accuracy on it. The trade was made knowingly: the real footage failure is evidenced
three times over, this one is synthetic, and 0.163 is still far better than the 0.446 it
started at. `smalltrack.js` holds the bound so it stays visible.

**Still unverified on the footage that matters.** No fixture reproduces the user's clip —
`canopy.webm` was built for it and tracks fine, because its outline fit succeeds where
theirs did not. Every change here is aimed at a cause the reports show plainly; whether it
fixes their clip is not something the suite can answer.

Suite: 442 checks green.

### ✅ v3.2 — the ring has to still be there (shipped)
Reported after v3.1: *"I try to manually move the ring to track with the player, but it
disappears after a few seconds"* — and, separately, *"the auto-tracking stopped within a
second or two"*. Both are the same thing, and neither is the matcher.
- **A spotlight inherited the four-second lifetime meant for arrows and scribbles.**
  `DEFAULT_DUR = 4` is right for a momentary mark and wrong for the object whose whole
  job is to follow a player through a play. A ring dropped at 0:00 simply stopped being
  drawn at 0:04. Spotlights now get `SPOT_DUR = 20`, capped at the clip.
- **Following him by hand was impossible past that point.** Once the ring is not drawn it
  cannot be grabbed, so there is no way to drag it back — and pinning him later recorded
  the point while showing nothing. Marking where he is now says he is there:
  `setSpotKey` stretches the ring's visible range to include any point put on it.
- **And this is why auto-track looked like it "stopped after a second".** It was allowed
  to run the whole clip both times (`stopBecause: clipEnd`, `stopAt: 15.713`) and did:
  it lost him at 0.5s in v2.9.6 and 7.375s in v3.0. But the ring is only drawn to where
  tracking last knew where he was, so on the bad run it vanished half a second in. The
  run and the ring were telling the same story and it looked like the run had stopped.
  With a spotlight lasting a play, a run that loses him leaves the ring in his last known
  place instead of erasing it, and the finish message says it lost him.

`multitrack.js`'s "a fresh ring still defaults to a short visible window (4s)" was really
a stand-in for "auto-track is not bounded by how long the ring is shown for". The
stand-in stopped meaning anything, so the guarantee is tested directly now: the window is
set deliberately short and the run is required to ignore it.

Four new checks in `smalltrack.js`, all of which fail on v3.1 — the fresh window is 4s,
the drags at 5s and 7s do nothing because the ring is not on screen to grab, and it ends
0.457 from where it was put.

Suite: 446 checks green.

### ✅ v3.3 — the edge of the picture, and an edit that never shipped (shipped)
The v3.2 report carried the number v3.1 was built to produce: **`bestPeak: 0.639`**. That
is the best any template could manage at finding him one frame later, against 0.93–0.98
on the fixtures — so no patch on the list is mostly the player, which is what every report
has said. Two concrete things came out of it.

**An edit that never shipped.** The report says `working: 960` from a 1280 source. v3.1
claimed to have stopped downscaling and had not: the edit script that made that change hit
an `AssertionError` on a *later* substitution and aborted **before writing the file**, and
only part of it was reapplied. The claim was in the commit message, the PLAN entry and the
PR, and none of it was true. Multi-edit scripts now get their result checked rather than
their exit line read.

**The ring ended pinned to the left edge** — `x: 0.000` for the last three seconds of the
clip, scoring 0.98 with all three templates agreeing. `bestMatch`'s search window was
clipped to the frame in v2.9.2, but the *patch* never was: `nccAt` clamps its reads, so a
template hanging off the edge re-reads the last column, and a smear correlates with itself
beautifully. A vote now requires the template to be at least 60% on the picture.

Also: the size ladder reaches genuinely small patches (down to `0.09 × ring`, floor 4),
because its smallest was still about twice the player's width on the footage that fails.

Closing this **also closed the regression v3.1 reopened**: `faint.webm`'s late look-alike
goes 0.163 → **0.006**, back under the strict bound, and the tests are strict again.

| clip | v3.2 | v3.3 |
| --- | --- | --- |
| `faint` late look-alike | 0.039 / **0.163** | 0.002 / **0.006** |
| `dim` | 0.002 0.008 0.002 | 0.001 0.007 0.005 |
| `canopy`, `body`, `small`, `trees`, `pan`, `crowd` | — | unchanged |
| `exit` | lost at 4.625s | lost at 4.625s |

Suite: 446 checks green.

### ✅ v3.4 — the ring fits itself to him (shipped)
*"I tested it, but didn't know how to create a smaller ring."* That is the correct answer,
and the bug was the instruction. **Ring −** is a small chip, in a row of eight, that only
appears once a spotlight is selected — and for four reports running the standing advice
was to go and find it. On a project whose stated bar is that an 88-year-old should succeed
unaided, telling the user to hunt for a control is not a fix.

The app had already measured which template size works. So it uses it: after choosing the
ensemble, the ring is **pulled in to fit whatever is actually being tracked** — only ever
smaller, never bigger, floored so it stays big enough to grab, and stated plainly
afterwards ("the ring was much bigger than he is, so it has been pulled in to fit him").
On `small.webm` a default 0.035 ring becomes 0.0177 with nobody touching anything.

The manual controls stay, and now say what they are: **🔽 Smaller ring** / **🔼 Bigger
ring** rather than `Ring −` / `Ring ＋`. The finish message no longer sends anyone looking
for a button; when it genuinely cannot hold him it says so and suggests a closer moment
instead.

Four new checks in `smalltrack.js`, and `ringWas`/`ringNow` in the report so the next one
shows whether it fitted itself.

Suite: 450 checks green.

### ✅ v3.5 — the ring is on his feet; his body is above it (shipped)
Measured, at last, instead of assumed. Extracting frames from the user's own screen
recording and counting pixels: **his shirt alone is about 29 x 78 px in the source video**
and his whole body is over 100 px tall. Every previous entry here asserted "roughly
13 x 26 px" — a number inferred from patch sizes, never measured, and repeated across nine
builds as though it were established. The "this footage is at the limit of template
matching" conclusion rested entirely on it and was wrong.

The real defect is visible the moment you look at a frame: **the ring sits around his
ankles.** That is where it lands, because a person drops it on the player and hits the
ground he is standing on. The template is a square centred on the ring, so it samples
boots and grass — while a red shirt with a large white number on it, by far the most
distinctive thing about him, sits fifty pixels higher and is never looked at once.

`fitPlayer` now measures him the way a person would: take the ground colour from the grass
**beside and below** the ring, then walk **up** row by row tracking how wide he is. He ends
where that width blows out, because trees and fences are wide and people are not. Earlier
versions measured outward in all directions and gave up unless they found open ground
everywhere, which on a park pitch never happens — his head is against a tree line. That is
why the outline fit never once fired on real footage.

The ensemble is then built from crops of **him** — tighter and looser — rather than squares
centred on the ring. Two guards keep this from doing harm elsewhere: the body crops are
only created when the outline actually comes back offset from the ring (nothing to correct
otherwise), and they only take over the ensemble in that same case.

**Why nine builds missed it:** every fixture dropped the ring on the player's *middle*.
`tests/fixtures/feet.webm` puts it where a person puts it — on his feet, with a tree line
above his head. With a square template it fails at err 0.061 / 0.179 / 0.297 / 0.416 while
reporting a peak of 0.859 and no loss: confident and completely wrong, which is exactly
what every report showed.

| clip | before | after |
| --- | --- | --- |
| `feet` t=1 / t=3 | 0.061 / 0.179 | **0.003 / 0.003** |
| `feet` t=5 / t=7 | 0.297 / 0.416 | 0.125 / 0.370 — still open |
| `faint`, `body`, `small`, `trees`, `pan`, `dim` | — | unchanged or better |
| `canopy` t=7 | 0.079 | 0.094 |

**Still open, and stated rather than hidden:** in `feet.webm` a team-mate in the same kit
crosses him at t=4 and takes the ring. Templates cut from his body cannot separate two
players who look identical — that needs motion, not appearance. A movement-based voter was
attempted and reverted: the first version was ten times too slow and the rewrite hung, and
shipping it unvalidated was the wrong trade. The test bounds hold the real numbers so the
gap stays visible.

Three assertions were rewritten rather than deleted: "no template reaches up into the
canopy" (reaching up is now a measurement, not a guess), and two that required an outline
in ensembles where one is now deliberately withheld.

Suite: 456 checks green.

### ✅ v3.6 — coasting is a bridge, not travel (shipped)
Retest of v3.5: *"it followed him for a bit then got lost."* Frames from the recording show
the ring ending up **against the left edge of the picture, on empty grass**, while the play
has moved to the middle of the frame — the camera panned right and the ring stayed behind.
- **Coasting used to travel.** When he cannot be matched for a moment the tracker moves on
  the last measured velocity, and it kept that speed for up to ten frames at up to a full
  search window each — enough to cross the picture. The guess now fades (velocity decays
  each coasted frame), and if it has carried the ring further than he could plausibly have
  gone unseen, the run declares lost rather than putting the ring somewhere he never was.
- New check: after a run ends, the ring must be left **where he was last actually seen**.

**What is not confirmed:** the saved path is trimmed back to the last good sample, so a
runaway coast should not survive into the ring's keys — which means this may not be what
put the ring at the edge on that clip. No tracking report was captured for the run, and
without one the rest is inference, which is the trap this whole investigation keeps falling
into. The change stands on its own (coasting should not travel, and it is neutral across
all ten fixtures) but it is not claimed as the cause.

Suite: 457 checks green.

### ✅ v3.7 — losing him is not the same as him being gone (shipped)
The first report where the tracker was working. v3.5's body-fit landed properly on a wide
Trace-style clip: all three templates cut from **his body, 15px above the ring**, finding
him a frame later at **0.966 / 0.967 / 0.952** — against 0.639, 0.538, 0.62, 0.62 in the
four reports before it. The ring sized itself 0.035 → 0.0161 with nobody touching it,
agreement ran at **0.91**, no template ever needed re-cutting, and it held him cleanly for
about **ten seconds** where earlier builds lost him inside one.

Then it ended, on a forty-second video — which is what *"it tracks for a little, but then
stops after a few seconds"* means.

**Losing him is not the same as him being gone.** He goes behind the goalkeeper, turns
away, gets small at the edge of a wide camera; two seconds later he is plainly there
again. Before ending, the pass now **hunts**: a wide search around where he was last seen,
using the **frozen first-frame templates** rather than the adaptive ones — the adaptive
ones have spent the last second learning whatever they drifted onto, and are the last
thing that should decide he has been found. He must be found convincingly and **twice in
the same place**, because picking the wrong player there is worse than admitting he is
lost. A successful re-find resets the budget, so a long clip can recover more than once.
A hunt still running when the clip ends counts as lost, not as a clean finish.

`tests/fixtures/hide.webm`: he passes behind an obstacle for about two and a half seconds
— longer than coasting can bridge. On v3.6 the run ends at 4s and the ring is 0.264 /
0.327 out afterwards. On v3.7 it re-finds him once and holds to the end at err 0.005.

All ten existing fixtures are unchanged.

**Still open:** the same-kit crossing in `feet.webm` (0.125 / 0.370). Two players who look
identical cannot be separated by appearance, and that needs motion.

Suite: 462 checks green.

## ✅ Shipped epic: v4 — "Lock-On" (AI-assisted tracking)

**Kickoff prompt for a fresh session:**
> Read CLAUDE.md and PLAN.md. Implement the v4 "Lock-On" epic exactly as specced in
> PLAN.md, phase by phase, starting with Phase 0 (the real-footage eval harness) — no
> tracker changes land unless the eval shows them winning on real clips. Run the full
> test suite before every push and update PLAN.md (checkboxes + decision log) as you go.

**The promise:** pick a player, press Follow, and the ring holds *him* — through
same-kit teammates crossing, through occlusions, for the entire clip — or says plainly
that it lost him and offers a one-tap way to carry on. Never a ring parked on empty
grass, never a silent switch to the wrong player.

**The decision that unlocks it (user-approved 2026-08-20):** bundle a small on-device
player-detection model (~5–10MB) next to `index.html`. Footage still never leaves the
machine; the app still works offline. `index.html` alone must keep working from
`file://` with the current v3.7 tracker as the automatic fallback when the model files
are absent or the browser is too old — the model is a progressive enhancement, not a
new requirement.

### Why detection, not better matching
Ten builds of evidence: appearance matching cannot distinguish two players in identical
kit — there is nothing to distinguish. Every serious tool (Trace, Veo, Hudl) tracks by
detection: find *all* players every frame, then identity becomes "which box is his
track" — a crossing is two tracked objects passing, not one template getting confused.

### Phases
- [x] **Phase 0 — real-footage eval harness (gate for everything else).**
      `tests/realeval/` — a runner that replays recorded clips through the tracker and
      scores them against ground-truth paths. Ground truth comes from the user: clips
      saved in the app plus hand-dragged paths (manual tracking works and its keys ARE
      ground truth). Ask the user for 3–5 real clips exported via **Keep this game** /
      project bundles: at least one same-kit crossing, one occlusion, one camera pan,
      one where he leaves frame. Every tracker change from here on must beat or match
      the previous build on this harness before it ships. Synthetic fixtures stay for
      regression, but no conclusion about real footage is drawn from them again.
      **Built and self-validated — waiting on the user's clips** (see "v4 progress"
      below; the harness runs, scores, and gates; the clip drop-folder is gitignored
      and empty until real footage is added).
- [x] **Phase 1 — model runtime, vendored and offline.** *(shipped — see "v4
      progress" below)*
      A person-detector (YOLO-class, quantized to ~5–8MB ONNX) + inference runtime
      (onnxruntime-web WASM/WebGPU) vendored into the repo as local files — no CDN, no
      network fetch, ever. WASM binary base64-embedded in its loader so `file://` works.
      Feature-detect: model present + browser capable → detection path; otherwise v3.7
      path untouched. Budget: detection at the pass's existing ~8fps working rate;
      first-run model load under 2s on a mid-range laptop.
- [x] **Phase 2 — tracking-by-detection.** *(built and proven on scripted
      detections; shipped OFF by default behind the real-clip gate, flipped ON
      2026-08-25 when the gate opened — see "v4 progress" below. Jersey-number
      OCR deferred, recorded in the log.)*
      Per frame: detections → boxes. Association (SORT-style): constant-velocity
      prediction + IoU + appearance (torso colour split — shirt/shorts/socks separates
      teams; within a team, geometry decides). **Track every player near him, not just
      him** — identity through a crossing comes from carrying both tracks through it.
      Jersey-number OCR opportunistically when the box is large and sharp enough,
      as a strong identity confirm, never a requirement.
- [x] **Phase 3 — the invariants.** *(on the detection path: flag-don't-guess,
      hunt + one-tap resume that stitches, 25s cap gone — see "v4 progress".)*
      (a) *No silent switches:* a track that swaps identity must score worse on the eval
      than one that admits uncertainty; when two same-kit tracks merge and split
      ambiguously, prefer flagging "check this moment" over guessing. (b) *Never
      stationary-lost:* a ring with no live track either hunts (v3.7) or says "lost him
      at 0:12 — tap him to carry on" with one-tap resume that stitches the path.
      (c) *Whole clip:* the 25s cap goes; long passes run chunked with progress and
      cancel, memory bounded.
- [x] **Phase 4 — polish + regression gate.**
      Eval suite in CI alongside the 462 existing checks. Tracking report gains
      per-track detection confidence. PLAN.md decision log updated with what the eval
      measured for every tuning choice.
      *(Done as far as it can be without footage: the eval selftest runs in `npm
      test` (the suite is 558 checks green), detection reports carry per-sample
      confidence, contested-margins and track counts, and every tuning choice made
      so far is in the decision log with its measurement. The real-clip eval
      numbers — the epic's acceptance — land with the flip decision, once the
      clips exist.)*

**Acceptance:** on the real-clip eval set — zero identity switches through same-kit
crossings; a 40s clip tracked end to end; leaving frame reported as lost within 1s with
working one-tap resume; all v3.7 fixtures still green; `file://` still fully functional
without the model files.

### v4 progress

**Phase 0 — shipped (harness built and self-validated; real clips still needed).**
`tests/realeval/` drives the real app the way a person does — load the video, ring on
him at the anchor, press Follow — then scores the written path against hand-dragged
ground truth (`score.js`): on-him % / error stats, coverage, **identity switches**
(stretches where the ring sits on a labelled look-alike while he is elsewhere — the
acceptance bar is zero), and **honest-loss accounting**: once the tracker *reports*
lost, later samples accrue lost-time instead of position error, while a ring silently
parked on grass keeps charging full error — so a tracker can never score better by
bluffing than by admitting it lost him. That encodes Phase 3's invariant (a) into the
instrument before any new tracker exists. `run.js --save-baseline` freezes the numbers;
`--gate` fails the run on any per-clip LOSS (tolerances small enough that seek jitter
cannot flip a verdict, large enough that a real regression cannot hide). Clips live in
`tests/realeval/clips/` which is **gitignored** — footage never enters the repo, in the
same spirit as never leaving the machine. `prep.sh` unpacks Keep-this-game bundle zips
and makes one-time WebM transcodes (the test Chromium has no H.264; real Chrome via
`CHROME_PATH` also works). Eval footage must be RAW video, never an annotated export —
a burned-in ring would falsify the eval. `selftest.js` (part of `npm test`, 32 checks)
proves the instrument: fabricated paths with known answers (perfect track scores
perfect; following the look-alike after a crossing counts exactly one switch; honesty
beats bluffing; off-frame windows excluded; WIN/TIE/LOSS verdicts fire correctly), then
one real end-to-end v3.7 run over `small.webm` against ground truth generated from the
fixture's own motion expressions — mean err 0.0035, 100% on him, coverage 1, 0 switches.

**→ Needed from the user to open the Phase 2 gate:** 3–5 real clips + hand-dragged
ground truth in `tests/realeval/clips/` per `tests/realeval/README.md` — at least one
same-kit crossing (with a second hand-tracked ring on the look-alike), one occlusion,
one camera pan, one where he leaves the frame.

**Tuning session 2 (2026-08-25) — the pan-out clip arrived, and the gate opened: WIN
on all three clips.** The new clip (parent hand-tracked, 48 keys, he exits the left
frame edge at ~7.9s) doubles as the camera-pan and leaves-frame acceptance cases.
First measurement: detection tracked the sustained pan at **87.1% on-him, err 0.0304**
(session 1's pan compensation working on a real pan) — but when he left the frame it
NEVER said lost: the whip culls every track, the play re-enters as a crowd of fresh
candidates, and the hunt re-found a look-alike among them and finished confident.

Measured to the fix, with the dead ends recorded: exit-extrapolation heuristics were
built and REMOVED (velocity EMA lags his exit dash, so the tracker's last SEEN speed
never predicts the exit — the code never fired); reach-radius tightening alone changed
nothing (identical numbers at gate×3 and gate×4). What worked is the invariant applied
literally: **a re-find after a long absence (>2s) must be the CLEARLY nearest same-kit
candidate (second candidate ≥1.8× farther), because two candidates in reach make it a
coin flip and the wrong player is worse than lost.** Short gaps stay exempt — position
memory over a second is still precise, and demanding uniqueness there killed the clip
where he dips out of detection inside his own team's crowd (coverage fell to 1%).
Plus the hunt's reach is capped (gate×4): a hidden player does not teleport.

That surfaced the recorded gate-design flaw in practice: every remaining LOSS verdict
was raw COVERAGE punishing honesty — the template "covers" 100% of a clip by wandering
with the ring on nobody, while detection declares lost and stops. compareCase now
scores **time actually on him** (on-him share × coverage) — the ring's whole job — and
raw coverage is no longer a criterion by itself; `selftest.js` proves the invariant at
the verdict level in both directions (an honest loss with high on-him quality BEATS a
full-coverage wanderer, and a wanderer can never beat it back).

**The scoreboard (2026-08-25, all parent-grade ground truth):**

| clip | v3.7 template | v4 detection | verdict |
| --- | --- | --- | --- |
| same-kit crossing 15.4s | 18.2% on-him, err 0.159 | **53.2%, err 0.0525** | WIN |
| pan-out + leaves-frame | 19.4%, err 0.109, loss 1.53s late | **96.4%, err 0.0123, loss 0s** | WIN |
| occlusion 14.2s | 21.4%, err 0.128, never lost | **52.5%, err 0.138 (tie), honest loss at 8s** | WIN |

**VERDICT: beats or matches the baseline on every clip — the flip is justified for the
first time.** Acceptance line-items: zero identity switches through the same-kit
crossing ✓; leaves-frame loss within 1s (measured 0s) with one-tap resume ✓ (resume
proven in lockontrack S3); whole-clip runs ✓ on these clips, 40s end-to-end proven on
the synthetic long.webm only (no real 40s clip in the set yet — worth one when
convenient); file:// without model files ✓; full suite green.

**THE FLIP — executed 2026-08-25, user-approved (build `v4.0`).** `lockonPathOn()`
now returns true unless `localStorage["filmroom:lockonPath"]` is `"off"`: detection
is the default tracker, the template tracker is the automatic fallback (loader
reports `lockon.js` absent, DecompressionStream missing, model boot failure) and the
deliberate off switch. Eval semantics follow the new reality — `run.js --path
template` forces the off switch, `--path detect` is what the app does on its own;
`lockontrack.js` S0 proves the off switch restores the template path, S1 proves
detection runs with no flag set at all. The flip surfaced one real UX hole the
suite caught as a race: the model boot (1–3s on first press) happened before any
feedback, so pressing Follow looked like nothing for seconds — the tracking pill
now goes up in the click itself ("getting ready…"). The template suites
(`tracking`/`hardtrack`/`multitrack`/`smalltrack`) pin the off switch: they are
the fallback tracker's regression suites, and which path a COCO model picks on a
synthetic fixture is an accident of the fixture (it sees the body-shaped player
in `feet.webm`, nothing in the rectangles); `lockon.js` proves the default press
with the real model and nobody detected hands itself to the template tracker.
Ongoing rule, unchanged: any tracker change must beat or match the committed
baseline on every real clip, verdicts measured as time-on-him, before it ships.

**Tuning session 1 (2026-08-24) — every change measured against the real clips, two
reverted, three landed.** The ground truth itself was hardened first: the recovered
occlusion ring path turned out to be contaminated by a SECOND pure-yellow object (an
orange-vested spectator passed the colour filter and the "truth" flip-flopped between
ring and vest at 4000px/s), so the extractor now demands the ring's exact signature
(G>185, R≥G, R−G<70) and the corrected path has zero direction flips. All prior
occlusion numbers were artefacts of that corruption; the baseline was re-measured
(template: 21.4% on-him / err 0.128) and every comparison below is on corrected truth.

Landed, each isolated and measured: **(1) hunt isolation** — a hunting spot's track no
longer participates in ordinary association, so a stray detection can never silently
re-capture it past the frozen-kit and found-twice checks (this was the wrong re-acquire
at the frame edge); **(2) local-first re-finds** — hunt candidates are chosen by
nearness to where he was last seen, never by detection score, and reach grows at
gate×3/s not ×8 (a high-scoring look-alike across the pitch must never outbid a
plausible candidate where he vanished); **(3) collapse-triggered full-frame sweep +
matched-residual pan compensation** — when association collapses (a camera whip:
every detection shifts together), the next step detects the whole frame, the median
matched residual measures the pan (a wide pass may estimate it but its pairings are
never committed as identity), and all tracks shift so association re-runs in
pan-corrected space at the NORMAL gate.

Reverted, each caught by the gate: a roaming coverage tile (stale tracks fed the pan
estimator systematic fake offsets toward whatever the crops covered — same-kit fell
42.9%→6.5% on-him) and gate-widening during sweeps (a doubled association gate in a
packed same-kit group slid the ring onto a parallel team-mate — same-kit 53.2%→6.5%).

Net, detection path before → after tuning: same-kit **42.9% → 53.2% on-him, err
0.119 → 0.0525**; occlusion err **0.410 → 0.296** (on-him 30%, unchanged). Versus the
v3.7 baseline the scoreboard is still mixed (same-kit WIN 53.2 vs 18.2; occlusion:
on-him better 30 vs 21.4, mean err worse 0.296 vs 0.128) → **the flip stays closed.**
The residual occlusion failure is now precisely characterised: perfect tracking to
t=4.75 (err 0.00), then a sharp direction reversal beside a same-kit team-mate coming
out of the occlusion — the velocity prior points at the team-mate, every contested
match reinforces it, and appearance cannot arbitrate. The tracker DOES flag the whole
window as check-this-moment (invariant 3a honoured — it is uncertain-wrong, never
silent-wrong), but flagged-wrong still scores as wrong, correctly. Next candidates,
recorded rather than attempted at midnight: multi-hypothesis carry-through for
contested same-kit splits, the ball-possession signal (v6-A), and one GATE-DESIGN
question to settle first: compareCase treats a coverage drop as a regression, which
means an honest mid-clip "lost him" can never beat a wandering 100%-coverage baseline —
that contradicts invariant 3a's "admitting uncertainty must score better than
switching" and needs a deliberate decision before the next tuning round.

**First real-clip eval (2026-08-24) — the gate held, and it said NO FLIP YET.** Two
iPhone clips with parent-grade ground truth (same-kit crossing: hand-tracked in the app,
111 keys over 15.4s; occlusion: the parent's hand-tracked ring recovered by
colour-extracting their annotated export after the project download lost the keys —
validated against detections, with the only gaps exactly spanning the occlusion):

| clip (full span) | v3.7 template | v4 detection | verdict |
| --- | --- | --- | --- |
| same-kit crossing 15.4s | on-him 18.2%, mean err 0.159 | **on-him 42.9%, mean err 0.119** | WIN |
| occlusion 14.2s | on-him 15.7%, mean err 0.156 | on-him 17.1%, **mean err 0.441** | LOSS |

Mixed verdict → the detection path stays off, exactly as the gate requires. The
occlusion diagnosis (per-sample report vs truth): detection binds and tracks him
correctly to ~t=4 (err 0.04–0.1), then loses him through a **hard camera whip during
the occlusion** — it walks left while the camera and player go right, hunts honestly
for four seconds, then re-acquires the wrong thing near the frame edge and finishes
confident (conf 0.6, err 0.7). The template tracker fails the same stretch less badly
(err 0.156) because it wanders rather than commits. Both trackers report 100% coverage
and never say lost — so the never-silently-wrong invariant is not yet real on this
footage for either path. Tuning targets, in order: (1) the hunt's re-find kit-colour
gate accepted a non-player candidate; (2) association/coast behaviour under whip pans
(the same failure family as v2.9.1's pan fixture, now with real numbers); (3) consider
camera-motion compensation from detection deltas. Also learned the hard way and now
guarded in the harness workflow: ground truth recovered from annotated exports must
discriminate the ring's pure yellow (R≥G) from a referee's yellow-green shirt, and
"max step speed" sanity checks are meaningless under camera pans. Every number above
is reproducible from the committed baseline plus `--path detect` on the same clips.

**Phases 2 + 3 — shipped OFF-BY-DEFAULT (build `v4.0p3`), gated on real clips.**
`autoTrackDetect` tracks by detection: every player near the play is detected per
sample (native-resolution crops, shared across spotlights), carried as its own
SORT-style track — constant-velocity prediction, greedy association by overlap +
distance + kit colour, per-match contested-margin — and "him" is simply the track the
ring is bound to at the anchor. A crossing is two tracks passing; the association unit
checks prove velocity keeps two same-kit tracks on their own detections through one,
and that kit colour is a CLIFF between teams (a clearly different kit can never buy a
match with nearness — measured: the gentle-nudge version lost exactly that case)
while within a team it is noise-sized and geometry decides. The ring rides each
detection at the feet (box bottom — where a person drops the ring, per v3.5) and fits
itself to the detected body, only ever shrinking (v3.4 rule).

The Phase 3 invariants, on this path: **(a)** a same-kit rival within reach, or a
contested association margin, marks the sample *uncertain* — coalesced into
check-this-moment windows in the report, said plainly in the finish message ("two
players in the same colours crossed and it may have picked the wrong one — play that
moment to check") — flagging over guessing. **(b)** never stationary-lost: an
unexplained absence goes to a full-frame tiled hunt (candidates must wear his FROZEN
start-of-run kit signature, be reachable from where he was last seen, and be found
twice in the same place — the v3.7 lesson kept); a run that still ends lost leaves the
ring at his last seen position and the toast's button arms **one-tap resume**: tap him
where you can see him and the pass carries on from there, stitching onto the path it
already has. **(c)** the 25-second cap is GONE on this path — bounded by the clip (or
an end the user set), progress and Esc-cancel throughout, memory bounded (tracks +
thinned keys only). The cap stays on the template path deliberately: changing v3.7
behaviour is what the eval gate judges.

**The gate is honoured in code:** the path runs only with `filmroom:lockonPath = "on"`
(localStorage), which nothing in the app sets — `tests/realeval/run.js --path detect`
sets it to measure both trackers on the same clips, and the flip to default-on happens
only if detection beats or matches v3.7 on every real clip (workflow in
`tests/realeval/README.md`). Even when on, a run where nobody is detected at the ring
falls back to the template tracker by itself, so the detector failing on some footage
never costs the user the tracker they had. **Deferred, stated plainly:**
opportunistic jersey-number OCR (spec'd as a confirm-only signal) is not built — there
is no vendorable OCR that meets the offline/licence bar at reasonable size, and a
guessed digit is worse than no digit; revisit if the eval shows identity errors that
colour+motion cannot resolve. Verified by `tests/lockontrack.js` (40 checks) driving
the real app with a SCRIPTED detector (boxes from the fixtures' own motion math,
dropouts and all): off-by-default, identity through the two.webm crossing, both
players in one pass, a 1.5s occlusion carried and re-found, honest loss within 1s +
ring left where he was last seen + resume stitching (17 keys, in order, spanning both
runs), the 40s `long.webm` clip end to end (cap gone), and the small.webm same-kit
crossing flagged at [4.38, 4.75] around the true crossing at 4.59 — plus a backwards run from a 7.5s anchor through the crossing (errs 0.000-0.003, keys in time order, tStart stretched to 0). What the stub
deliberately does not test — YOLOX's detection quality on real players — is exactly
the realeval harness's question.

**Phase 1 — shipped (build `v4.0p1`).** `lockon.js` (8.5MB, generated-but-committed,
reproducible byte-for-byte by `tests/make-lockon.js` from SHA-256-pinned upstreams)
carries onnxruntime-web **1.17.3** `ort.wasm.min.js` (MIT) + `ort-wasm-simd.wasm` and
**YOLOX-Nano** (Apache-2.0, 3.66MB ONNX, 416×416, COCO) — both payloads gzip+base64
(19MB → 8.5MB), inflated in the browser with `DecompressionStream`, the wasm served to
ort through a **blob-URL `wasmPaths`** override. Everything measured, not assumed:
1.19.x's UMD bundle cannot boot from `file://` at all (its wasm backend dynamic-imports
an `.mjs` glue whose URL resolution throws `Invalid URL`), and 1.17.3 ignores
`wasmBinary` but honors blob-URL `wasmPaths`; RGB raw 0–255 input scores slightly above
BGR on a real photograph, so RGB it is; the full embedded stack finds the people in a
real photo correctly. In `index.html`: `loadLockon()` (lazy, single-flight, quiet
`absent` on any failure so the v3.7 tracker carries on untouched), `lockonDetect(src,
cx, cy, crop)` — detection runs on a **native-resolution crop** around the play rather
than a downscaled whole frame, which is what keeps a 12px player detectable —
plus pure `lockonDecode`/`lockonNms` exposed for tests, and the tracking report now
carries `lockon: untried|loading|ready|absent` so every future report says which path
ran. `sw.js` caches `lockon.js` (cache bumped to v3). Measured first load: **1.16s**
in the headless VM (budget: 2s on a mid-range laptop). `tests/lockon.js` (16 checks):
zero network requests during load, lazy startup, decode/NMS proved on fabricated
tensors with answers known by construction, plain grass detects no one, and
`index.html` copied ALONE to an empty folder still runs the v3.7 tracker with the
loader reporting `absent` — the synthetic fixtures contain no real people for a
COCO-trained detector, so detection quality on real players is exactly what the
Phase 0 harness measures once real clips arrive.

---

## ✅ Shipped epic: v5 — "Reel Studio" (recruiting & social highlight packages)

**Kickoff prompt for a fresh session:**
> Read CLAUDE.md and PLAN.md. Implement the v5 "Reel Studio" epic exactly as specced in
> PLAN.md, workstream by workstream, in order (A→F). The design bar is a product Meta,
> Apple or Google would ship: run the walkthrough screenshot suite after every
> workstream and judge the screenshots against that bar, not against "works". Run the
> full test suite before every push and update PLAN.md as you go.

**The promise:** a parent can turn a season of tagged clips into a recruiting package —
master reel, social cuts, single-play shares, full-match index, player one-pager — in an
evening, without watching a single tutorial, and the result looks like a top studio made
it. Good enough that no other tool is ever needed (user-stated bar, 2026-08-20).

**User decisions (2026-08-20):** all four formats; full recruiting package including
player profile; game audio + voice-over, no bundled music (text hooks for social);
optional bring-your-own-audio explicitly out of v1 unless trivially cheap.

### The five content modes (research-driven, baked into templates)
1. **Recruiting Master Reel** — 16:9, 1080p, 3–5 min, 20–35 clips. Best play FIRST
   (coaches decide in 30 seconds). Spotlight ring + freeze-frame "watch #87" intro on
   every clip so the scout never hunts for him. Opening title card: name, grad year,
   positions, height, club, GPA, contact. Per-clip context label (opponent, competition,
   date). Outro contact card ≤5s. Game audio or silence — never music.
2. **Attribute Chapters** — the differentiation weapon. Optional chapters inside the
   master reel or standalone: *Technique*, *Game IQ*, *Work Ethic*, *Athleticism*.
   Game IQ is where this app has a moat no editor can copy: decision-point freezes with
   his recorded answers and voice-over — evidence of scanning and thinking, not claims.
   Work Ethic = defensive recovery runs, pressing sequences (clips tagged work-rate).
3. **Social Teaser** — 9:16 vertical, 30–60s, for IG/TikTok/Shorts. Auto-reframed using
   the tracking path so he stays centred in the crop (this is why v4 ships first). Hook
   text in the first 2 seconds, captions burned in, handle watermark.
4. **Single-Play Share** — one moment, trimmed tight, spotlight on, exported in seconds,
   sized to text to a coach the same evening.
5. **Full Match + Index** — the verification layer serious recruiters ask for: the
   whole game plus a clickable timestamp index of his involvements (YouTube chapter
   text auto-generated).

### Workstreams
- [x] **A — Player Profile.** One card, filled once, reused everywhere: name, jersey #,
      grad year, positions, height, club/team, league, GPA/academics, contact, socials,
      photo. Lives in localStorage + Games folder sidecar. Feeds every title card,
      one-pager and export filename ("Name – Grad Year – Position – Reel").
      *(Shipped 2026-08-25: 🎽 Player card section in the Clips tab + modal, plain
      words throughout. Card JSON in localStorage; the photo is shrunk to ≤512px JPEG
      and lives in IndexedDB (the voice-over quota lesson); both travel as
      `player.filmroom.json` in the Games folder root, newest `savedAt` wins in both
      directions and adopting from the folder says so in a toast (the continuity
      rules, applied to the card). The reel's opening card leads with his name, roster
      line and photo once the card exists — the card's WORDS come from
      `reelCardLines()` so tests assert language, not pixels — and reel exports are
      named "Name - Grad year - Position - Title". No card → everything exactly as
      before. `tests/profile.js`, 25 checks.)*
- [x] **B — Reel Builder.** A storyboard mode over the existing cross-game clip
      library: auto-suggested draft (strength-tagged and highly-rated clips, ordered
      best-first), drag to reorder, per-clip trim, spotlight toggle, freeze-frame intro
      toggle, context labels auto-filled from the game data. Coach-guidance built into
      the UI as quiet hints ("your best play goes first — scouts decide in 30 seconds"),
      never as a wall of text. Position-aware suggestions (GK/CB/FB/CM/W/ST attribute
      checklists).
      *(Shipped 2026-08-25: 🎬 Reel Studio in the top bar — works with no video open,
      because the reel is about the season, not a game. The pool reuses the trends
      dashboard's collectGames (localStorage + Games folder sidecars); suggestions are
      strengths first then teachables, scored up for boards/questions/notes, work-ons
      never offered. "✨ Draft it for me" proposes, the person disposes: drag-handle
      reorder (pointer events, finger-friendly) plus ↑↓, half-second trims folded
      behind ✂ and bounded by the clip, 🎯 spotlight / ⏸ freeze-intro toggles stored
      per play for the C render, labels auto-filled "game · date" and editable.
      Coaching is one quiet contextual line (best-first / 3–5 min sweet spot / over
      five minutes / end high), and the position checklist reads his player card and
      ticks what the plan's titles+tags+notes already show. The plan stores clip
      SNAPSHOTS re-synced from the real games on open — a vanished game marks its
      plays ⚠ missing, never drops them. Persists as filmroom:reelStudio + travels
      as reels.filmroom.json (newest savedAt wins, both ways). Removing a play and
      clearing the plan carry their own Undo. Rendering the storyboard into the
      finished video is Workstream C, and the surface says so plainly.
      `tests/studio.js`, 32 checks.)*
- [x] **C — Render pipeline.** Extends the existing WebCodecs + hand-rolled muxer:
      title/outro/freeze-frame cards drawn by `drawScene`-grade canvas code (crisp
      typography, no clip-art), 16:9 master and 9:16 auto-reframe outputs, voice-over
      mixed as today, burned-in captions for social. Time-remaining estimate on long
      renders.
      *(Shipped 2026-08-25. `exportProgram` extended, all opt-in so every existing
      export is bit-identical in behavior: per-item `src` plays ANOTHER game's footage
      through one offscreen video element (files read from the Games folder),
      `drawScene` gained an annotations override so each play draws its own game's
      spotlight, media is contain-fit into a fixed 16:9 1080p frame, and audio
      segments carry their source file (`buildFastAudio` demuxes per file; voice-overs
      were already keyed by clip id so they mix cross-game unchanged). The master reel
      = recruiting opening card (name/photo/roster/stats/contact) + per-play "Watch
      #81" freeze intro (ring at his tracked position) + context line burned low +
      his ring only — no coach title cards and no decision-point freezes, those teach
      the family — + ≤5s contact card. The 9:16 social cut is cards-free: a cover-crop
      window follows the tracked spotlight path (smoothed, clamped), hook text for the
      first 2s, a caption pill per play, handle watermark. Missing game files are
      named first and skipped only on an explicit second press. Long renders say
      "about N minutes left" from measured pace. `tests/render.js` (12 checks, stubbed
      encoder per the fastexport pattern) proves the two-game program shape, the
      coach-named files, the missing-game flow, and — by sampling the output frames —
      that the social crop keeps the tracked ball mid-frame while the source pans.
      Real-browser caveat recorded honestly: cross-game GAME audio needs mp4/mov
      sources (the demuxer is mp4-only, as ever); WebM-only sources fall back to
      silent exactly like today's single-game path.)*
- [x] **D — Distribution kit.** Auto-generated alongside every export: YouTube
      title/description with chapter timestamps, a coach-email template with the
      player's details filled in, and a self-contained one-page player site
      (single HTML file: photo, profile, embedded poster frame, links to reels) that
      works from any hosting or attachment.
      *(Shipped 2026-08-25 as "✉️ Save the sharing kit" in the studio: one zip
      (the bundle zip writer reused) holding YouTube.txt — title + description with
      chapter times computed by the SAME math as the render, so they match the reel
      second for second; Email to a coach.txt — subject and body written from his
      card, only the fields that exist; player page.html — single-file site with the
      photo and a poster frame from his actual footage baked in as data URIs, roster
      chips, the season play index, a mailto contact, zero external fetches; and a
      READ ME FIRST.txt saying what each piece is for. Gated on the player card
      existing (the kit is written FROM it) with a plain-words toast otherwise.
      `tests/kit.js`, 15 checks incl. real `unzip` listing.)*
- [x] **E — Design-system pass.** Tokens (type scale, spacing, radii, motion), a
      considered light+dark palette, micro-interactions on the storyboard, and a
      Reel Studio surface that reads as a distinct, calm, premium mode. Judged on
      walkthrough screenshots against the Meta/Apple/Google bar. The Grandma Test still
      applies: every next step visible, in plain words.
      *(Shipped 2026-08-25. Studio design tokens (`--st-*`: spacing, radius, one
      ease-out curve, one duration) and a calmer card surface one step below the
      app's panels; micro-interactions throughout the storyboard — cards lift on
      hover, enter with a 220ms rise, labels underline on focus, toggles and
      checklist ticks transition — all behind `prefers-reduced-motion`. Toggle ON
      state is a quiet green tint, not a solid block: with ring+intro on by default,
      solid pills made every card shout. The light/dark palette decision is recorded
      in the log: the app itself stays deliberately dark (a film room), and the
      OUTWARD artifacts — the player page, the exports — are the considered light
      surface. Judged on screenshots at each step; the Reel Studio surface is now
      part of the comfort.js WCAG-AA contrast audit with a real plan rendered, so
      the bar is enforced by the suite, not by one review.)*
- [x] **F — Tests + docs.** Suites for profile persistence, builder ordering, render
      correctness (muxer-level checks like `bundle.js` does), reframe-follows-track,
      one-pager integrity; README + walkthrough updates; PLAN.md log.
      *(Shipped 2026-08-25, mostly alongside each workstream: `profile.js` (25),
      `studio.js` (32), `render.js` (13, incl. the mp4-container probe of the studio
      output and the pixel-sampled reframe-follows-track proof), `kit.js` (15, incl.
      real `unzip`). Closeout added: `realeval/reframe.js` — the 9:16 acceptance
      measured on the REAL clips with the renderer's own math (pan 100%, same-kit
      96.5% in-frame; occlusion 64.1%, bounded by the recorded v4 occlusion open
      item, not by the reframe — the gate flips green when that tracking item is
      solved); the walkthrough gained the Reel Studio step (screenshot + the
      quiet-coaching check); comfort.js audits the studio; READMEs updated per
      workstream.)*

**Acceptance:** from a library of tagged clips, a first-time parent reaches a finished
master reel in under 30 minutes without help; every export passes the muxer checks; the
walkthrough screenshots of Reel Studio would not look out of place in an Apple keynote
slide; 9:16 cuts keep the player in frame for ≥95% of their duration on the eval clips.

**Acceptance status (2026-08-25, epic shipped, build v5.0):** muxer checks ✓ (the
studio output rides the proven mp4 writer; container probed in `render.js`); the
under-30-minutes-unaided bar is designed for (draft + drag + one-line coaching, the
Grandma rules throughout) and awaits the user's first real run to be called met;
screenshots judged at every workstream and the studio is in the AA audit; 9:16
in-frame ≥95% holds on 2 of 3 real clips (pan 100%, same-kit 96.5%) — the occlusion
clip measures 64.1% because its back half is the RECORDED v4 tracking open item
(flagged-wrong identity through the occlusion), not a reframe defect; `reframe.js`
re-measures it in one command once that item is solved.

---

## ✅ Shipped epic: v6 — "Cutting Room" (find the moments, make the cuts, and an Autopilot)

**Kickoff prompt for a fresh session:**
> Read CLAUDE.md and PLAN.md. Implement the v6 "Cutting Room" epic exactly as specced in
> PLAN.md, workstream by workstream (A→E). Build it after v5 Reel Studio, on top of the
> v4 detection tracker. Workstreams A–C are gated the way v4 was: no suggestion feature
> ships unless its eval shows it agreeing with the human's own past choices on real
> footage. Run the full test suite before every push and update PLAN.md (checkboxes +
> decision log) as you go.

**The promise:** open a game, press **"Find his moments"**, and get back a checklist of
candidate involvements — accept or reject each in seconds instead of scrubbing for
hours. Accepted moments arrive already trimmed to the action. And for anyone who wants
it, an opt-in **Autopilot** carries a game all the way to a finished draft reel —
always a draft to review, never a decision made behind your back.

**The standing guardrail, restated (it shapes every workstream):** this app's founding
principle is that *choosing the moment is the coaching* — questions before answers,
self-awareness through his own observation. So v6 automates **recall and mechanics**
(finding candidates, tightening cuts, assembling drafts) and keeps **judgment** with
the human by default. Full automation exists as a tier you deliberately switch on, and
it is graded — not trusted.

### Workstreams

- [x] **A — the ball joins the tracks.** YOLOX-Nano already knows COCO's "sports
      ball" class; wire it into the detection pass as a second tracked object type.
      A ball is small, fast and motion-blurred — much harder than a player — so this
      gets its own eval before anything builds on it: hand-marked ball paths on the
      realeval clips (same hand-dragged ground-truth method, a ring labelled `ball`),
      scored by the same harness. From ball + his track, derive the **possession
      signal**: stretches where the ball converges to his feet and travels with him.
      Gate: ball-in-frame coverage and possession windows validated against
      hand-marked truth on the real clips; numbers in the decision log.
      *(Built and instrumented 2026-08-25; accuracy gate OPEN pending the user's
      hand-marked ball paths. Class 32 rides the SAME inference (decode emits
      `kind:'ball'`, NMS per kind, every player consumer stays ball-blind by one
      filter); one greedy ball track — wide gate, honest recording only when seen,
      pan-compensated with everyone else — lands in the report as `report.ball`
      {coverage, samples}, and `possessionWindows()` (pure, proven on constructed
      paths) reports per-spot possession. Measured on the real clips, player metrics
      BIT-IDENTICAL with the ball riding along (WIN vs baseline on all three):
      near-play ball coverage 17.7% pan / 0% same-kit / 0.9% occlusion at first —
      the ball is tiny, blurred, and invisible to the model even at 4× crop
      magnification in the same-kit crowd (probed at threshold 0.03) — then one
      measured change, a dedicated MAGNIFIED ball look per step (a tighter crop at
      the ball's predicted spot, else his feet), lifted it to 31.3% / 9.7% / 2.7%
      with player numbers unchanged, and a plausible possession window appeared on
      the pan clip. Honest reading: possession is a sometimes-signal on this
      footage, so the Moment Finder (B) must treat it as one voice among several,
      never the backbone. `realeval` now scores a GT ring labelled `ball`
      (excluded from him/decoys; scoreBall: coverage-where-visible, meanErr,
      on-ball%) and prints ball + possession lines; selftest proves the scorer on
      fabricated paths; lockontrack S9 proves the whole chain with a scripted
      ball whose possession window is known by construction.)*
- [x] **B — Moment Finder.** A whole-game scan (chunked, progress + cancel,
      overnight-friendly on an hour of film) that emits candidate moments
      `{start, end, why}`: on-ball touches (from A), sprints (track velocity), box
      entries, defensive recovery runs, dense-action stretches near him. Presented as
      a checklist with a 3-second preview each — accept turns one into a clip, reject
      teaches nothing silently (rejections are counted, not learned from, so behaviour
      stays predictable). **The gate is his own history:** run the finder over games
      already broken down by hand — it must surface at least ~80% of the moments dad
      chose himself, at a precision that keeps review under a few minutes per game
      (roughly: no more than 3 rejects per accept). The clips he already saved ARE the
      ground truth for "what this family calls a moment".
      *(Built 2026-08-25; the recall gate is an instrument awaiting hand-broken-down
      games. "✨ Find his moments" in the Clips tab: ring on him → one press runs the
      detection tracker to the end of the game (its own progress + cancel carry the
      long wait; a fresh scan spanning ≥60% of the game is reused instead of re-run)
      → `momentCandidates()` — PURE over the tracking report — turns his path, the
      camera's measured per-step pan (frame speed alone under-reads exactly the runs
      the camera follows), the per-sample crowd count and the possession windows into
      padded, merged candidates said in plain words ("he had the ball · a sprint").
      The sprint threshold is adaptive above a floor, so a quiet game yields nothing
      rather than its own 85th percentile of strolling. Checklist modal: ▶ 3-second
      look, YES creates an ordinary clip (notes name the finder — provenance visible),
      NO is counted only, and the tally says so out loud. Box entries and true
      recovery runs need pitch geometry one sideline camera does not give — recorded
      as out of v1 rather than faked; sustained sprints stand in as "a long hard run".
      `realeval/moments.js` grades recall (≥80%) + review cost (≤4 candidates per
      accept) against any project with saved clips, replaying the SHIPPED arithmetic
      in the real page; the eval projects hold zero saved clips today, so the gate
      opens on the user's real games. `tests/moments.js`, 18 checks.)*
- [x] **C — Auto-Cut assist.** Proposed In/Out tightening for any clip, from track +
      ball data: start on the pass that begins the move, end a beat after the payoff,
      cut on the touch rather than mid-run; a speed-ramp suggestion for social cuts.
      Always shown as a proposal ("Tighten to the action?") with one-tap accept and
      undo. Gate: measured against the hand-set In/Out points of the existing clip
      library — median difference from his own edits within ~1.5s per end — plus every
      proposal is reversible.
      *(Built 2026-08-25; the gate instrument awaits hand-broken-down games, like
      B's. `proposeCut(clip, report)` — pure, sharing ONE `traceSpeeds()` with the
      Moment Finder — finds the active stretch (adaptive threshold, possession counts
      as action), starts 1s before it, ends on the last touch + 0.8s when the ball
      data shows one (else last activity + 1s), only ever proposes WITHIN the clip,
      and returns null rather than nagging: short clip, uncovered span, already
      tight. The proposal carries the ramp — the fastest 1.5s inside the kept range —
      stored on the clip as `c.ramp` for the social cut to use. In the app the
      "✂ Tighten to the action?" button exists only while a proposal does (a
      tracking report covering the clip in this session); one tap trims via
      `mutate()` and the toast's own Undo restores ends and ramp exactly.
      `realeval/autocut.js` grades the shipped arithmetic in the real page: each of
      his clips widened 3s per side, re-tightened, medians per end vs his real cuts
      (bar 1.5s), no-opinion nulls reported apart. `tests/autocut.js`, 14 checks.)*
- [x] **D — the metadata socket (import/export contract).** Two versioned files that
      make outside intelligence pluggable without the app ever needing a network:
      `filmroom-metadata.json` (everything about a season EXCEPT pixels — clips, tags,
      ratings, notes, questions and his answers, moment-finder output, track summaries)
      and `filmroom-reelplan.json` (ordered clip ids, chapters, per-clip trims, titles,
      hooks, captions, distribution text). The app exports the first and **imports the
      second into the reel builder as a reviewable draft**. This is the socket the
      Autopilot plugs into — and the same socket a future on-device model would use.
      *(Shipped 2026-08-25. In the studio: "📋 Save the season as data" writes
      `filmroom-metadata` v1 — his card WITHOUT the photo (the photo is pixels),
      every game's clips/tags/ratings/notes, his questions and answers, moment
      accept/reject counts, spot-track summaries, and the current reel plan by
      reference (game + clipId + trims + toggles) — the export is asserted to
      contain no `data:` URI anywhere. "📥 Load a reel plan" reads `filmroom-reelplan`
      v1 into the storyboard as a DRAFT: items resolved against the real pool
      (snapshots refreshed, trims clamped into the actual clip), unknown plays kept
      and marked ⚠ (the storyboard's missing semantics), the previous plan one
      toast-Undo away. Wrong format / newer version / empty plan are refused in
      plain words with the current plan untouched. Round trip proven lossless.
      `tests/socket.js`, 19 checks.)*
- [x] **E — Autopilot (the full-automation option; OFF unless switched on).** A
      documented Claude Code workflow (checked into the repo as `AUTOPILOT.md`) that
      drives the whole line end to end on the user's own machine: read the metadata
      export → run the Moment Finder over the new game → pick and order the reel with
      coach/marketing judgment → write the reel plan → drive the app headlessly to
      render (the same way `tests/` already drives it) → hand back a finished draft
      mp4 **plus a review sheet**: what it chose, what it passed on, and the moments
      it was unsure about, in plain words. Three privacy tiers, escalating only by
      explicit choice:
      - **E0 — metadata only (default):** the model reads numbers and words, never
        pixels. Footage never leaves the machine, same as always.
      - **E1 — stills on approval (per-run opt-in):** selected still frames of
        candidate moments may be sent to the model for judgment calls (is this the
        play to lead with; is the framing clean). Stills only, never video, and the
        run says which frames went.
      - **E2 — fully local (future):** swap the judgment calls to an on-device
        multimodal model once one meets the same vendorable bar lockon.js did
        (licence, size, offline). Full autonomy with the privacy rule fully intact —
        this is the end state as models improve.
      **The gate is edit-distance:** every Autopilot draft records how many human
      corrections it took (reorders, swaps, re-trims, title rewrites). That number,
      tracked release over release, IS the measure of "fully capable at a professional
      level" — the epic's own definition, not a vibe. Hard rules: Autopilot output is
      always a draft in the reel builder; it never exports on its own authority and
      never posts anywhere.
      *(Shipped 2026-08-25 as E0. `AUTOPILOT.md` in the repo root is the whole
      recipe — the hard rules in writing (draft-only, never posts, tiers escalating
      only by explicit per-run choice, E2 explicitly "do not simulate"), the run
      steps, the review-sheet format with a "Not sure" section, and the ledger
      protocol. The app side: every imported plan is FINGERPRINTED
      (`studio.imported`), and the next season-data export carries
      `reelPlan.editsSinceImport` — removals, additions, reorders (LCS), re-trims,
      retitle — so the report card is measured by the app, never self-graded by the
      session. The render leg is `tests/autopilot/render.js`: drives the real app
      headlessly (plan in → "DRAFT - …" mp4 out, never overwriting, one game per
      run with multi-game plans refused toward the app's own button; real Chrome
      via CHROME_PATH for H.264, `--check` says so). `tests/autopilot.js` asserts
      the DOCUMENT's promises as tests, counts a real UI correction session
      (reorder + retrim + retitle = 3) in the ledger, and runs the driver end to
      end with the stub encoder. 14 checks.)*

**Can it eventually make the whole video by itself?** Mechanically it already can —
the render pipeline is drivable end to end today, headlessly, exactly the way the test
suite drives it. What improves as models improve is the *judgment* (which moments,
what story, what a scout wants next year) and, at E2, where that judgment runs. The
edit-distance gate is designed so the answer is measured rather than argued: when
drafts routinely need zero corrections and spot-checks stay clean, full automation has
earned itself, one release at a time.

**Acceptance:** on games already broken down by hand — Moment Finder recall ≥80% of
his chosen moments at reviewable precision; auto-cut proposals within ~1.5s of his own
trims at the median; ball/possession numbers published from the realeval harness; the
reel-plan import round-trips into the builder losslessly; one full Autopilot E0 run
produces a draft reel + review sheet with zero pixels leaving the machine; all
existing suites green; the app alone (no Claude, no model files) still does everything
it does today.

**Acceptance status (2026-08-25, epic shipped, build v6.0):** ball/possession numbers
published ✓ (near-play coverage 31.3% pan / 9.7% same-kit / 2.7% occlusion after the
measured magnified-look change; player tracking bit-identical; ACCURACY awaits the
user's hand-marked `ball` rings — `realeval` scores them the moment they exist).
Reel-plan round trip ✓ (lossless, proven). Autopilot E0 machinery ✓ end to end (plan
imported as draft → real-app headless render → "DRAFT - …" mp4, zero pixels read at
any point; the first full JUDGMENT run happens on the user's machine per AUTOPILOT.md
and its edit count becomes the ledger's first entry). All suites green ✓ (719 checks
before this closeout, more after). App-alone ✓ (the lockon-absent path is tested
every run). The two measured-against-his-history gates — finder recall ≥80% and
auto-cut medians ≤1.5s — are INSTRUMENTS awaiting data: both run over any game
folder that has his saved clips plus a detect report (`realeval/moments.js`,
`realeval/autocut.js`); the eval clips carry no saved clips, so these numbers are
honestly unmeasured until the user drops in a broken-down game. The finder and
assist ship as offers either way — the gates decide when their numbers are worth
advertising, not whether a parent may use them.

---

## 🚧 Current epic — v9 "Less hand-holding" (the run carries on, the reel makes itself)

**Goal (user, 2026-09-05):** the ring should hold him for longer stretches without a
tap from the parent, and a highlight reel should take as little effort as possible.
The audit of the same day (`docs/AUDIT-2026-09-05.md`) traced both to mechanics rather
than to the matcher: a run ended at the first honest loss after a 5-second hunt, the
Moment Finder only ever saw the LAST run's report, and a reel cost a click per moment
plus a click per clip.

- [x] **Carry on by itself (detection path).** The hunt keeps looking for up to 30 s
      (`HUNT_FOR` 40 → 240 steps). The identity rules do not loosen with time, they
      tighten: inside 5 s (`HUNT_LOCAL`) the old reach-from-where-he-vanished rule
      stands; beyond it position memory is stale, so the reach opens to the whole frame
      and a far candidate earns ONE full-frame look on the confirming step (`x.sweepNext`
      → every hunt tile detected at once): he counts only if he is the only unassigned
      wearer of his kit anywhere in the picture. Two wearers → the hunt goes on, and after 30 s the run ends LOST with the ring parked where he was last
      seen, exactly as before. A re-find after ≥ 2 s (`TRACK_GAP_MIN`) records a **gap**
      on the ring (`spot.gaps = [{from, to}]`, optional field, JSON stays compatible)
      and `drawSpot()` draws nothing inside it — shared by the live overlay and every
      export — so the ring never glides across ground nobody saw him on. The one-tap
      resume records the tapped-over stretch as the same kind of gap, and the resumed
      run now **joins its report onto the one that ended lost** (`ui.stitchFrom`;
      `report.stitched` counts the joins, `startedAt` reaches back), so the Moment
      Finder and Auto-Cut read the whole game rather than the last segment. Template
      path untouched. `tests/lockontrack.js` S3 (resume stitches report + gap, ring
      hidden inside it), S10 (8 s absence carried on alone, gap recorded, followed to
      40 s), S11 (same absence with a same-kit team-mate walking in → LOST, no swap).
- [ ] **The real-clip gate for the carry-on change (user's machine).** Per the v4
      rule, this tracker change ships only if `node tests/realeval/run.js --gate`
      beats or matches `baseline.json` on every clip. Synthetic proof is in; the real
      numbers are the user's to run before merging. Expected effect: the occlusion
      clip's back half (an honest loss at 8 s today) may now re-find him if he comes
      back alone; the same-kit clip must show zero switches still.
- [x] **✨ Make his reel (one press).** In the Highlight reel box: from the ring,
      `ensureGameScan()` (shared with the finder) runs or reuses the whole-game scan,
      `pickReelMoments()` — PURE — ranks the finder's candidates (score, then length),
      fills a ~4-minute / 8-moment budget and orders them the way the studio teaches
      (best first, the rest in game order, second-best last), each becomes an ordinary
      clip whose notes say where it came from, `proposeCut()` tightens it exactly as the
      parent's own tap would, anything already in this week's list stays in front, the
      title defaults from his card and the game, and the app lands on the reel with one
      Save button and a toast whose Undo removes the whole draft. Judgment stays with
      the parent — one look instead of one click per moment. `tests/autoreel.js`, 19
      checks. Not automated on purpose: pressing Save (the v6 draft-only rule).

## 🚧 Current epic — v8 "Phone-first" (the iPhone as the primary device)

**Goal:** the parent films the game on the iPhone and breaks it down *on the iPhone*,
picking footage straight out of Photos. The Mac stays the place for the heavy jobs
(the season reel), but nothing about the daily loop should require it.

**What made this possible without a rewrite:** `collectGames()` already reads
localStorage first and treats the Games folder as an extra, so the season features
(Progress, Reel Studio planning) work with no folder API at all. The gaps were about
*keeping* work and *finding it again*, not about the editing itself.

**The three phone truths this epic answers:**
1. There is no File System Access API in any iOS browser — Chrome and Edge on iOS are
   Safari underneath — so the Games folder can never exist there. The library has to be
   built from the work itself, not from a folder of films.
2. localStorage is small (~5MB) and iOS clears it for sites left idle. Autosave alone is
   not safekeeping.
3. The Photos picker can hand the same video back under a different name (and re-encoded),
   which the old `videoKey` (`name:size`) read as a brand-new game — silently orphaning
   every clip attached to it.

- [x] **Sprint 1 — the vault, the list, and re-linking (shipped).**
      - **Vault:** every save is mirrored into IndexedDB (`vault:<videoKey>`) alongside
        localStorage, which stays the fast synchronous read. Work now survives an iOS
        storage clear-out; a quota failure says so once in plain words instead of
        failing silently, and `navigator.storage.persist()` is requested at boot.
      - **My games:** with no folder API, 📁 Games becomes the list of games this device
        has work for (built from localStorage + vault, newest first, with clip counts and
        length). It stays hidden until there is at least one, so a first run never offers
        an empty drawer. Tapping one opens the Photos picker.
      - **Re-linking:** projects now record `videoSize` and `videoDuration`. When an exact
        key misses, `findSameGame()` matches an identical byte size (conclusive) or the
        same running length within 0.35s, and the work follows the renamed file — with a
        toast that says which name it used to have. A genuinely different video is not
        adopted (asserted).
      - **Honest limits:** the season reel needs footage from many games, so on a device
        with no folder it says the reel is made on the computer that holds the films —
        single-moment exports still work on the phone.
      - `manifest.webmanifest` theme/background moved to Onyx `#121212`.
      - Tests: `tests/phonefirst.js` (13 checks) runs the whole suite with
        `showDirectoryPicker` removed — vault mirroring, clear-out recovery, the games
        list, a renamed re-link, and the negative case. `tests/library.js` updated for the
        button's new job.
- [x] **Sprint 1 hardening (shipped).** A post-merge review of the Sprint 1 diff found
      nine real defects, all fixed with regression tests: the startup "My games" probe ran
      before the vault's store was declared (a swallowed TDZ error left the list empty in
      exactly the iOS-eviction case the vault exists for — the probe now runs after the
      vault, and the eviction case is asserted); a stale localStorage copy could shadow a
      newer vault copy after a quota failure and then overwrite it (newest-wins by
      `savedAt` now); re-keying an adopted game left the old key's entries behind (one
      game listed twice, and reopening the old name forked the project — `retireKeys()`
      moves them, asserted both for the sure match and the confirmed offer); the
      now-async `onloadedmetadata` had no currency guard (opening a second video while
      the first was still looking itself up could put game A's work under game B's
      footage); the length-match adoption skipped `renderClipList`/inputs and could fire
      against a video opened after the offer (full loadVideo-style swap now, with a
      same-video guard and the fingerprint updated to the newly opened file); the
      debounced save flushed only on `beforeunload`, which iOS often skips (now also
      `pagehide` and `visibilitychange→hidden`, asserted inside the debounce window); and
      `vaultAll()` did one IDB round-trip per game (one ranged `getAll` now).
      `tests/phonefirst.js` grew from 13 to 26 checks.
- [x] **Sprint 2 — portrait-first layout (shipped).** At iPhone width the top bar had
      wrapped to five rows and ate half the screen: it is now one thumb-scrollable row
      (the same pattern the board and compare bars already use), every button still
      present in order with its full plain words, and the 📦 Project menu opens as a
      fixed sheet so the scrolling bar cannot clip it. On any stacked layout (<980px)
      the side panel gains a ⌄ handle in its tab row that tucks it down to just the
      tabs — the video area roughly doubles (219→471px at 390×844) and the marking
      controls land in thumb reach — and tapping any tab, or the handle again, brings
      it back; `layout()` refits the video and overlay on every toggle. Desktop is
      untouched (asserted). Tab wiring and the ⌘K registry were scoped to
      `#tabs button[data-tab]` so the handle joins neither. Tests: `tests/portrait.js`
      (13 checks) at a real iPhone viewport, including un-clipped Project menu,
      overlay refit, and the wide-screen no-op.
- [ ] Sprint 3 — verify on a real iPhone. **Confirmed by the user so far (2026-08-27):**
      the hosted page loads in Safari and Chrome, Add to Home Screen works, the Photos
      picker opens and selects — and after a real session, "the ability to access videos
      from the apple photos app is fantastic." Still unanswered from the list below:
      heat/memory on a full game, persistence after backgrounding, whether Photos
      renames picks (the re-linking assumption), on-device export, tracking speed. **Still to run — the ten-minute phone test,
      in order, with a real full-length game from Photos:**
      1. Open the game from Photos. Does it load and scrub smoothly? Does the phone
         get hot? (This is the memory/heat question — a 60-90min iPhone file is the
         real test, not a clip.)
      2. Mark and save two clips, then flip to another app for a minute and come
         back. Still there?
      3. Close the app fully, reopen from the home screen, tap 📁 My games, pick the
         same video from Photos again. Do the clips come back — and did the toast
         mention a different file name? (That answers whether Photos renames picks,
         the assumption the re-linking is built on.)
      4. On one saved clip, press 🎬 Save video. Does the file arrive and play?
      5. With the panel tucked (⌄ on the tab row), spotlight him and run
         🎯 Auto-track for a few seconds. Usable speed on the phone?
      Report what misbehaves — each numbered item maps to a specific subsystem.

- [x] **Sprint 4 — sideways and closer (shipped, from the first field report).** The
      user's on-device report: scrubbing was hard without a wider landscape view, pinch
      zoom into the players, and the marking buttons at hand. All three delivered:
      - **Rotate to watch:** turning the phone sideways hides the top bar (a portrait
        job), auto-tucks the panel sheet, and gives the film the height — any tab tap
        brings the panel back, turning upright restores everything, and a one-time hint
        explains it. The transport controls become one sideways-scrollable row (they
        wrapped to four rows at phone width and quietly starved the video — fixed in
        portrait too). Root cause fixed along the way: `#left` had `min-width:0` but not
        `min-height:0`, so in the stacked column the fixed-pixel video wrap set the
        column's minimum and pushed the transport and tabs off a landscape screen.
      - **Pinch to zoom:** two fingers zoom (1-5×) and pan the picture, anchored under
        the fingers; a 1× chip brings the whole picture back; a new game starts
        unzoomed. Pure VIEW transform on the wrap — `evNorm()` reads the transformed
        rect, so one-finger drawing stays exact at any zoom (asserted to 0.03), and
        exports are untouched. A second finger landing mid-gesture unwinds whatever
        the first accidentally started (undo for keyed moves, discard for previews);
        `pointercancel`/`lostpointercapture` clean the finger bookkeeping (the Sprint 1
        lesson, applied from the start).
      - Tests: `tests/pinchzoom.js` (17 checks) drives real two-finger CDP touch
        gestures and asserts elements are ON SCREEN (`rect.bottom <= innerHeight`),
        not merely rendered — the weaker check had passed while the tab row sat 128px
        below a landscape screen.
- [x] **Sprint 5 — the film IS the screen (shipped, from the second field report).**
      On a real iPhone, Sprint 4's landscape came out SMALLER than upright: Safari's own
      bars plus the stacked timeline/controls/tab strips ate a 375px-tall screen. The
      report asked for three things — the picture maximized to the whole screen, the
      common marking tools at hand, and easier manual ring work — and reported the
      Photos access as "fantastic" (Sprint 3 item confirmed).
      - **Overlaid, not stacked:** sideways, the film now fills the full viewport
        (390/390 at test size, 693px wide vs 390 upright — +78% linear) with pillarbox
        space at the sides. The transport floats translucent over the film's bottom
        edge — full-width finger-sized timeline, one-row controls, safe-area padded —
        and the panel opens OVER the film from 🧰, tucked away entirely by default.
      - **The thumb rail:** a 2×4 grid floating at the right edge — the six draw tools,
        🎯 Follow (appears when a ring is selected, driving the real #selTrack), and
        🧰 (the full worded panel). Every rail tap drives the same handler as the panel
        button it mirrors; active state is synced both ways. Icon-only is allowed HERE
        because the rail is an accelerator: the fully-worded toolGrid remains one 🧰
        tap away, and every rail button carries a full-sentence tip.
      - Two columns because eight stacked buttons are taller than a sideways phone —
        the bottom ones sat under the floating transport's taps (caught by the suite:
        the transport intercepted the 🧰 tap).
      - Tests: the landscape half of `tests/pinchzoom.js` rewritten for the new truth
        (24 checks total): full-height film, transport overlay, rail drives the real
        tools, ring-from-rail, Follow appearance, panel over film, rail absent upright
        and on desktop.
**Hosting is live (checked 2026-08-27):** GitHub Pages has been deploying every merge to
`main` since 2026-08-18 — 31 successful `pages build and deployment` runs, the latest
being the v8 Sprint 1 merge (`5f63a09`), all three jobs green. The app is on the phone's
home screen path at `https://lossanchez-svg.github.io/game-footage-splicer/`. This was
recorded as an open blocker in three places for far longer than it was true; the lesson is
the usual one — **check the record against reality before repeating it**. Note that a
sandboxed session cannot fetch `github.io` (egress proxy), so deployment is verified
through the Actions API, and only a real device confirms the page renders.

## 🚧 Current epic — v7 "Onyx" (UI refresh)

The audit and sprint-by-sprint spec live in **`UI_REFRESH_PLAN.md`** — same tool,
quieter and closer: a neutral matte re-skin, accelerated pathways to existing actions,
and two-tier disclosure. Hard rules: zero capability changes, every new pathway routes
through the same handlers the existing buttons call, and `drawScene()`/`PALETTE`/the
export renderers are frozen so old exports keep matching the editor.

- [x] **Sprint 1 — Onyx foundation (shipped).** Neutral #121212–#1A1A1A token set
      (`--bg/--bg2/--bg3/--bg-raise/--line` + new `--edge-hi`/`--shadow-pane`/
      `--radius-clip`), full hardcoded-color sweep of the style block, chroma demoted
      from decorative spots (logo, tab underline, watch-banner gradient, Reel-Studio
      blues, scrims, tip bubble, scrollbars, placeholder) and kept for selection,
      live state, in/out range, data ratings and primary actions; pane depth shadows
      (top bar, transport, sidebar — both orientations) and a shared inset top-edge
      highlight on cards. CSS + `theme-color` meta only; no markup/JS changes.
      `manifest.webmanifest` theme/background colors deliberately untouched (hosted
      PWA only) — pick up alongside the PWA refinement item.
- [x] **Sprint 2 — tangible timeline (shipped).** Clip marker bars became blocks
      (6px radius, top-lit gradient over the rating color, edge highlight + shadow,
      hover lift); the playhead is the accent blue with a soft glow; the marked
      range grew grab handles on both edges (drag to retime, the frame follows,
      26px hit area on touch, the transport buttons and I/O keys unchanged); and
      quick-mark chips follow the mouse along the timeline — "Start clip here /
      End clip here" at the exact spot you are pointing, no seeking first (mouse
      only; touch keeps the buttons). All routes through the existing mark state
      and handlers. Verified: chips mark, handles retime a saved clip end-to-end,
      plain click still seeks; smoke/touch/comfort/tips/plainwords/tour/
      walkthrough/friction/watch green.
- [x] **Sprint 3 — ⌘K command bar (shipped).** First a pure extraction: the nine
      inline clip-card closures became named functions behind one `clipAction(act, c)`
      dispatcher (identical behavior, one source of truth for what you can do to a
      clip). Then the bar: ⌘K / Ctrl+K from anywhere opens a typed palette whose
      entries are the real buttons (label + `data-tip` sentence is the search text;
      running an entry clicks the real control, so guards, toasts, undo and hints are
      inherited) plus tab switches and every saved clip by name. Word-start-weighted
      scoring, ↑/↓/Return/Esc, never stacks over an open dialog, closes cleanly
      (blur — a hidden focused input would swallow the shortcut map), disabled during
      sessions/tracking/export. In the Help table and README. No proactive hint —
      it must never become a step Grandma needs. Verified by `tests/cmdbar.js`
      (15 checks) + full UI regression set green.
- [x] **Sprint 4 — timeline clip micro-menu (shipped).** Hovering a clip block on the
      timeline fades in a small menu naming the clip (rating dot, title, times) with
      ▶ Play · ✏️ Edit · ➕/✓ Reel — plus ✂ Tighten only when `proposeCut()` has a
      proposal — every button routed through `clipAction()`, with the sidebar's own
      tip sentences. 150ms hover-intent delay, grace timers to reach the menu,
      reduced-motion honored. The seek click is untouched, the quick-mark chips
      yield while over a block, and it is mouse-only: on touch the Clips tab stays
      the way in. Verified by `tests/micromenu.js` (12 checks) + regression set.
- [x] **Sprint 5 — smart-drop zones + drag-to-reel (shipped).** While a file is
      dragged over an open game, the stage splits into labelled targets: "🎞 Open as
      this game" (the original behavior) and — once at least one clip exists —
      "⚖ Use as the example side", which routes the file into Compare via the same
      loader the 📂 File… button uses (extracted as `cmpUseFile()`). Dropping
      anywhere else, or before a game is open, behaves exactly as before, and both
      plain-words failure toasts are preserved word for word. Clip cards grew a ⠿
      dot (mouse only, hidden on touch) that drags onto the Highlight reel section —
      it lights up and the drop calls the same `toggleReel()` as ➕ Reel. Verified by
      `tests/dropzones.js` (14 checks) + 16-suite regression set.
- [x] **Sprint 6 — progressive disclosure (shipped).** Clip cards went two-tier:
      the daily verbs (▶ Play · ➕ Reel · ✏️ Edit, plus ✂ Tighten when proposed)
      stay out, and 🎬 Save video · 🗒 Board · ⚖ Compare · 🎤 Voice · 🗑 Delete sit
      behind a "⌄ More" fold that remembers being open per clip across re-renders;
      🗒/🎤 attachment glyphs moved into the card head so folded state stays
      visible. The top bar's three project-file jobs (💾 Save / 📂 Load /
      📦 Keep this game — same IDs, same tips) folded into one **📦 Project ⌄**
      menu that closes on outside press or after a job. The spotlight panel fold
      was **descoped with rationale**: `#selSection` is already progressive
      (appears only on selection, buttons conditional by type), and folding it
      would churn four tracking suites for no daily-density win. Tests: shared
      `openDisclosures()` helper in `tests/common.js`; nine suites updated at
      their now-folded click sites; full affected set green.
- [x] **Post-merge hardening (shipped).** A code review of the merged v7 diff found
      seven real defects, all fixed: ⌘K no longer offers controls hidden by feature
      detection (📁 Games on Safari) while keeping tab-panel/folded controls
      reachable — inline `display:none` is the discriminator; ✂ Tighten's Undo now
      restores a clip's pre-existing speed ramp instead of deleting it; the in/out
      handles, the timeline scrub, and the drag-to-reel dot all clean up on
      `pointercancel`/`lostpointercapture` (an interrupted iPad drag no longer leaves
      a leaked pointermove that edits marks on mere hover, or a phantom reel-drop);
      the timeline micro-menu respects the same session/tracking/exporting guards as
      the quick-mark chips and ignores bars detached by a re-render during its hover
      delay; `seekFromEvent` now goes through `timeFromClientX`; and the three new
      suites fold `launch()`'s collected page errors into their exit codes (plus a
      cmdbar regression check for the hidden-control rule).
**Epic status: all six sprints shipped.** Remaining from the audit doc: the optional
Stretch S-A audio-energy strip (needs an iPad memory spike measurement first — see
`UI_REFRESH_PLAN.md` §2.4) and the sidebar fold-labels-to-words refinement below.

## Roadmap

### Next (in order)
- [x] **v2 epic — The Grandma Test** (full spec in "Current epic" above): guided
      do-based tour, real tooltips + one-time hints, plain-language pass, Watch front
      door, comfort/text-size mode, friction fixes. **All six workstreams shipped**
      with suites `tour.js`, `tips.js`, `plainwords.js`, `watch.js`, `comfort.js`,
      `friction.js`, plus the `walkthrough.js` screenshot pass; 251 checks green
      across the whole suite.
- [x] **Cross-device continuity via the Games folder** — shipped, see v2.1 below.
- [x] **Tracker tuning from real footage** — unblocked and done, see v2.9 below. The
      user sent a screen recording of a real sideline clip where the ring left the player.

### Later (unbuilt features)
- [x] Track multiple spotlights in one pass; track backwards from an anchor — both
      shipped, see v2.5 and v2.6 below.
- [x] Per-player trend dashboard — shipped, see v2.2 below.
- [x] Project bundles — shipped, see v2.7 below.
- [x] Voice-over recording on exports — shipped, see v2.4 below.
- [x] Boards render as interstitial cards in exports — shipped, see v2.8 below.
      (Pulling *compare* content into a reel is still unbuilt.)
- [x] Session insights — shipped, see v2.3 below.

### Known refinements (smaller, pick up alongside other work)
- [ ] Realtime (🔊) export produces webm in Chrome — either label the tradeoff more
      clearly in the picker or route audio-needing exports through fast-mp4 + audio
      everywhere it's supported and retire the realtime path.
- [x] Whole-video fast export of a long game: time-remaining estimate — **already
      shipped in v5-C and stale here**: `exportProgram()` (shared by single clips,
      whole-game exports and reels) computes `estFrames` up front and `sayTimeLeft`
      updates the busy message every second of output once 5s of pace has settled.
      Verified wired (`sayTimeLeft` called from `pushFrame`); nothing to add.
- [ ] Board: no undo *within* a chip drag (each drag is one undo step — verify feel).
- [ ] PWA: verify installed-app behavior on a real iPad/iPhone (icon, offline,
      orientation). Hosting is no longer the blocker — **Pages is enabled and deploying**
      (see the v8 epic); what is unverified is how the *installed* app behaves on a real
      device, which is v8 Sprint 3.
- [ ] Tag editor renames update the current project only — decide whether that's enough
      or renames should also rewrite other stored projects when opened (migration note).

## Where this sits against Trace's paid tiers

The user's footage comes from a Trace camera, and the standing question is whether this
app can displace what Trace charges for. Checked August 2026 — Trace sells **Basic**
($180/yr, 2 seats) and **Pro** ($300/yr, 4 seats).

| Trace charges for | Film Room |
| --- | --- |
| Unlimited playlists; "download playlist as one video" (**Pro**) | ✅ The reel + **Save as one video**, with coaching cards, question freezes and game audio burned in — Trace's playlists are bare clips |
| Downloading highlights (**Pro**) | ✅ Every export is a local file; nothing is gated |
| Auto-spotlight on your player during playback | ✅ Spotlight + auto-track, rebuilt in v1.4 specifically for zoomed-out Trace footage — plus arrows, zones and questions Trace has no equivalent for |
| Per-seat family access | ✅ No accounts at all; AirDrop the file |
| Individual/team analytics (**Pro**) | ✅ **v2.2 progress dashboard** — and on a different axis: game-IQ tags (scanning, decisions, touch, positioning) across a season, which Trace structurally cannot derive |
| **Auto-capture**: every player's moments cut automatically hours after the whistle | ❌ Not replaceable — hardware + cloud. Film Room needs a human to choose the moment (which is the point, but it is not the same product) |
| **Heatmaps / physical stats** (**Pro**) | ❌ Comes from their worn sensor; no positional data here |
| **Trace iD** sharing profiles | ❌ Cloud service, and against the no-accounts principle |

**Position:** *Basic + Film Room replaces Pro* — about $120/yr saved, with better film
sessions. Some subscription stays necessary because the footage has to come out of their
system at all. Unverified (their site is blocked from this environment): whether Basic's
"last 5 matches" limit and full-game **download** (vs. watch) are workable — worth
checking on the real account, and it overlaps the standing Trace-footage question below.

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
- **Real-footage validation** (standing item): synthetic fixtures isolate failure modes,
  but only real film shows the rest — same-jersey players converging, motion blur, heat
  shimmer. After each feature that touches tracking or export, the user runs it on one
  real Trace clip and one zoomed-out iPhone clip and reports where the lock number drops
  or playback misbehaves; that feedback drives tuning.

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
| 2026-08-18 | Fast-export audio = demux AAC → range decode → sample-exact reassembly → re-encode (no edit lists) | Multi-edit `elst` silence gaps play unreliably outside Apple players; decoding only the clip's range keeps memory flat on hour-long files; passthrough covers browsers without AAC encode when the timeline has no gaps |
| 2026-08-18 | Sessions run the reel list (one "this week" set), not a separate playlist | One ordering UI; the reel IS the session's content — export it for TV or run it live |
| 2026-08-18 | Autosave flushes on beforeunload | The 600ms debounce could drop the last write if the tab closed immediately (surfaced by the session suite); flush-on-unload closes the race for all data |
| 2026-08-18 | Board reuses the video draw functions + tool palette on a separate canvas | One visual language everywhere; board items are the same shapes minus time, plus a `chip` type; undo snapshots widened to boards/reel/sessions |
| 2026-08-18 | Compare: A is the master clock, B hard-resynced per frame (no free-running B) | Start-sync alone drifts; per-frame correction keeps the pair within one frame indefinitely; B side can be an external file (loaded, never persisted) |
| 2026-08-18 | Photos intake: native picker on iOS, folder library on Mac — never fight macOS Photos drags | No web API can browse the Mac Photos library; iOS's file input IS the Photos picker; a remembered iCloud Drive folder is the cross-device equivalent of an album |
| 2026-08-18 | Tour steps advance on the user's action, never a "Next" button | A "Next"-driven tour teaches nothing — the hand has to do it once; the do-based version also can't get ahead of a user who is still figuring the step out |
| 2026-08-18 | Tour ring dims via a giant `box-shadow` spread with `pointer-events:none` | Keeps the rest of the UI visible AND clickable (no trap), with no overlay maths and no extra elements |
| 2026-08-18 | Custom `data-tip` bubbles replace native `title` everywhere | `title` never renders on iPad and takes ~1.5s on desktop — useless for someone hunting for what a button does; a long-press tip also has to swallow its click so exploring can't trigger anything |
| 2026-08-18 | One-time hints stay silent while the tour is running | Two voices telling a first-timer what to do at once is worse than either alone; the hints then land later, when the tour is no longer there to say it |
| 2026-08-18 | Frame rate hides under "Advanced"; everything else is spelled out | It is the only genuinely technical setting left, and it only affects two buttons — burying it costs nothing and removes the one piece of jargon from the main transport bar |
| 2026-08-18 | The jargon ban is enforced by a test, not by review | Wording drifts back in with every feature; `tests/plainwords.js` sweeps the rendered DOM and the toast literals so a regression fails the suite |
| 2026-08-18 | The watch banner is dismissed per visit, never permanently | It is an offer, not a notification: someone who came to edit dismisses it once, and the next person to open the game still finds the session waiting |
| 2026-08-18 | Primary-button green split into `--accent` (marks) and `--accent-btn` (text backgrounds) | White on the brand green measured 3.4:1 — below AA. Darkening only the button background keeps the brand colour everywhere it carries no text |
| 2026-08-18 | Contrast is enforced by a computed-style audit in the test suite | A one-off manual audit rots on the next feature; the audit walks real rendered text, so new screens are covered automatically |
| 2026-08-18 | Deletes never ask, they offer Undo — with their own captured snapshot | A confirm dialog taxes every correct deletion to prevent a rare wrong one; an Undo that pops the shared stack would restore the wrong thing once anything else has been edited, so the toast holds the exact snapshot |
| 2026-08-18 | Every control that needs a video says so and points at Open | "Nothing happened" is the worst possible feedback for a first-time user — it reads as broken software rather than a missing step |
| 2026-08-18 | Project JSON is mirrored next to the video as `<video>.filmroom.json`, keyed off the Games folder | The folder is already the thing the user syncs (iCloud); writing beside the video means continuity needs no accounts, no server, and no new concept — and a plain JSON file next to the film is self-explanatory if anyone finds it |
| 2026-08-18 | Newest `savedAt` wins on open, and the toast names the source | Two devices will diverge eventually; silently preferring either one can destroy an evening's work, so the rule is simple, stated, and visible when it fires |
| 2026-08-18 | Write permission is requested when a game is opened, not when the folder is chosen | Browsers only grant readwrite from a user gesture, and the open click is the one that reliably exists — asking at folder-choose time would strand anyone whose folder was connected before this feature existed |
| 2026-08-18 | The trend view compares early vs recent games as per-game rates, not raw counts | The two halves of a season rarely hold the same number of games, so raw counts would report "more heavy touches" purely because you broke down more film in October |
| 2026-08-18 | "What is changing" is prose, not a chart | It is the one insight a parent acts on, and a sentence ("about 2 a game early on, 0 a game lately") is read where a dumbbell chart is decoded; the bars above already carry the magnitudes |
| 2026-08-18 | The dashboard reads localStorage *and* the Games folder sidecars | v2.1 made the folder the cross-device source of truth; a season view that ignored it would under-report every game broken down on the other computer |
| 2026-08-19 | The app shell is served network-first, not cache-first | Cache-first meant every fix arrived a visit late, so a user testing a fix ran the code from before it. Being one version stale is far more damaging than the one request network-first costs, and the cache still covers going offline |
| 2026-08-19 | The build version is visible in the top bar | Two debugging rounds were spent unable to tell whether a report came from the fixed code. A stamp in every screenshot removes that whole class of ambiguity |
| 2026-08-19 | The tracking patch is chosen by distinctiveness, not taken from the ring | The ring marks WHERE the player is; on zoomed-out film it says nothing about how big he is, and a template that is 97% grass matches grass everywhere at 0.9 confidence. Measuring how well the surrounding field can impersonate each candidate size picks a patch that is actually about the player |
| 2026-08-19 | `bestMatch` prefers candidates near the prediction | Team-mates in the same kit are indistinguishable to a template matcher, so an equal-scoring look-alike crossing the window would take the ring and the tracker would follow the wrong player, confidently and silently. A distance penalty on the choice (never on the reported score) makes an impostor have to be clearly better |
| 2026-08-19 | Candidate patches below an RMS-contrast floor are rejected | A patch entirely inside one flat-coloured object has zero variance and correlates with nothing — it scores 0 even against the player it was cut from. Caught only because it broke an existing suite |
| 2026-08-19 | A clip's board plays after the clip, not before it | The board is the explanation; leading with it hands over the answer before he has committed to one, which undoes the whole questions-before-answers guardrail |
| 2026-08-19 | The board card measures its own contribution in tests (export the same clip with and without) | Asserting a total frame count bakes in every other card's length, so an unrelated change to the title card would fail the board test and teach nobody anything |
| 2026-08-19 | The bundle zip is verified with the real `unzip` binary, not by re-reading it in-app | The entire point of an archive is that *other* software opens it in five years; a self-consistent reader would have proved nothing. `unzip -t` checks every CRC |
| 2026-08-20 | v4 will bundle an on-device player-detection model; the zero-dependency rule bends, the privacy rule does not | User-approved. Ten builds proved appearance matching cannot separate identical kit — detection-based tracking is how every serious tool does it. The model is vendored locally, footage never leaves the machine, and index.html alone still works from file:// with the v3.7 tracker as fallback |
| 2026-08-20 | Reels carry game audio and voice-over, never bundled music | Licensed music gets reels muted or blocked on the platforms parents post to, and recruiters prefer natural sound. The voice-over feature already built is the differentiator; social cuts get text hooks |
| 2026-08-20 | The Game IQ chapter is built on decision-point answers, not claims | Every editor can cut fast plays together. Recorded freeze-frame questions with his own answers are evidence of scanning and thinking that no generic tool can produce — it is the moat |
| 2026-08-20 | A lost track hunts for him before the run ends | He goes behind someone, turns, gets small at the edge — and is plainly back two seconds later. Ending there is what "it tracks for a bit then stops" is, on a clip where he is visible for another thirty seconds |
| 2026-08-20 | The hunt uses the frozen first-frame templates, and must find him twice in the same place | The adaptive templates have spent the last second learning whatever they drifted onto, so they are the last thing that should decide he has been found. Re-finding the wrong player is worse than admitting he is lost |
| 2026-08-20 | A coasted guess fades and is bounded, rather than continuing at speed | Coasting exists to bridge a second where he cannot be seen. Continuing at the last measured velocity for ten frames at up to a search window each is enough to carry the ring clear across the picture, which looks exactly like the ring wandering off on its own |
| 2026-08-20 | The tracked patch is placed on his body, above the ring, not centred on it | The ring lands on the ground he is standing on, because that is where a person puts it. A square centred there samples boots and grass; his shirt and number sit fifty pixels higher and were never looked at |
| 2026-08-20 | His extent is measured by walking UP from the ring and watching the width | Measuring outward in all directions requires open ground above his head, which a park pitch never provides — trees, fences, parked cars. That is why the outline fit never fired on real footage across four reports |
| 2026-08-20 | Fixtures place the ring where a person places it, on the feet | Nine builds of fixtures dropped it on the player's middle and so could not reproduce the reported failure at all. The fixture was wrong, not the reports |
| 2026-08-20 | Player size is measured from real frames, never inferred from patch sizes | "Roughly 13 x 26 px" was an inference repeated as fact across nine builds and was wrong by about 4x per axis; a conclusion that the footage was untrackable was built on it |
| 2026-08-19 | The ring sizes itself to the player rather than asking the user to | The app measures which template size works before it starts; telling someone to find a small chip in a row of eight is not a fix, and four reports in a row came back with a 90px ring around a 13px player because of it |
| 2026-08-19 | A template must be substantially on the picture for its match to count | nccAt clamps its reads, so a patch hanging off the edge re-reads the last column and correlates with its own smear at 0.98. The search window was clipped to the frame long ago; the patch never was, and the ring finished a real run pinned to x = 0.000 |
| 2026-08-19 | Multi-edit scripts are verified by their effect, not their exit line | An AssertionError on a later substitution aborted a script before it wrote the file, so a change that was described in a commit message, a PLAN entry and a PR simply did not exist. The report caught it two builds later |
| 2026-08-19 | A spotlight lasts a play; arrows and scribbles keep the four-second default | They are different kinds of object. One marks a moment, the other follows a player through one, and sharing a lifetime meant the ring stopped being drawn while the player was still running |
| 2026-08-19 | Putting a point on a spotlight stretches its visible range to include it | Marking where he is is a statement that he is there. Recording it while showing nothing is incoherent, and once the ring is not drawn it cannot be grabbed, so there was no way back |
| 2026-08-19 | Patches are scored by peak-to-sidelobe margin on the next frame | Distinctiveness is biased toward contrast, raw next-frame score toward tiny crops, and each put a useless template in charge on real footage. What a tracker needs is a patch that matches him much better than it matches anything nearby, which is one subtraction and is the thing both proxies were failing to stand in for |
| 2026-08-19 | The ensemble is chosen for spread of scale, not by ranking | Three candidates ranked by one number are three near-identical crops: they fail together and agree with each other while doing it, which is an ensemble in name only |
| 2026-08-19 | The outline fit measures width and derives height from it | Sideways there is open grass either side of a player so the measurement terminates; upwards his head runs into tree lines and fences, and demanding open ground in every direction meant the fit never once succeeded on real footage |
| 2026-08-19 | Auto-track works at the footage's own resolution | The old rule sized the working frame from the ring, which assumes the ring is sized to the player — false in exactly the case that fails, where it discarded a quarter of the detail on a ten-pixel subject |
| 2026-08-19 | No single template is chosen; several track together and the ring goes where they agree | Three separate measures were tried for predicting whether a patch would track — size, body shape, distinctiveness — and each was wrong on real footage, the last one preferring a boxful of tree canopy. The problem is not which measure but that anything is picked once and committed to for the whole clip |
| 2026-08-19 | Ensemble members track independently rather than sharing an averaged position | Sharing one centre coupled them: a drifting template moved the centre, which dragged the others' next search, and all three followed the wrong player in perfect agreement. Trackers that cannot disagree are not an ensemble |
| 2026-08-19 | When templates split, the side continuing his motion wins | With identical kit, appearance cannot separate two players. Motion can, and it is the only signal that stays valid across different footage, angles and subjects rather than being tuned to one clip |
| 2026-08-19 | Every template must find him one frame on before the run starts | It is the question distinctiveness was standing in for, and asking it directly costs one seek instead of being wrong three times |
| 2026-08-19 | Clip in/out marks no longer bound an auto-track run | "Follow him from here" means follow him. A clip end marked minutes earlier stopped every run at that point and reported it in the same words as a successful run, which is indistinguishable from a broken tracker — the four-second trap of v2.5 in a new form |
| 2026-08-19 | A run that ends early names the boundary that ended it | The failure was never that the run was short; it was that "Followed him for 1.0 seconds" is the same sentence whether it hit a boundary or gave up. A duration alone is not a diagnosis |
| 2026-08-19 | The accept bar is NOT warm-up calibrated, though the anchor floor is | Measured: lowering it to what the template achieves made hard footage markedly worse (err 0.004 → 0.190), because a high bar refuses bad matches and coasts on prediction instead. A change that looks symmetrical is not automatically right on both sides |
| 2026-08-19 | The template is a box fitted to the player, not a square centred on the ring | Same-kit team-mates are identical in colour, so shape is the only thing left to match on, and a square either misses his body or fills with the ground beside him — 92% field on the clip that failed. Fitting his actual extent is measurable per clip; guessing an aspect ratio is not |
| 2026-08-19 | The fitted box carries twice his measured size | A skin-tight body box failed exactly as the square did (err 0.405): a template holding only the player has no surroundings to hold position with and slides onto the next player in the same kit. x2.5 breaks other clips, so the margin is a measured optimum, not a direction to push |
| 2026-08-19 | Distinctiveness sets the accept bar but no longer picks the patch shape | It is size-biased — smaller always separates from grass better — so it scored a whole-body box below a torso-sized square that tracked far worse. A proxy metric that disagrees with the outcome it is proxying for should not be the one deciding |
| 2026-08-19 | Match thresholds are derived from the measured impostor score, not hardcoded | pickPatch already computes how well the field impersonates the template; `ACCEPT = 0.45` sat below that measurement (0.511) on real footage, so the tracker was accepting grass by its own arithmetic. A constant cannot know how hard the footage is; the measurement already does |
| 2026-08-19 | Fixtures are built to a measurement, not to a hypothesised mechanism | Three rounds of reproductions passed because every fixture scored 0.74-0.87 distinctiveness against real footage's 0.489. Building `faint.webm` to that number reproduced the failure on the first run, after three mechanism-guesses had failed |
| 2026-08-19 | The late-clip look-alike swap is recorded as a known gap with a bounding test | It is a real remaining failure and needs motion-consistency logic that is a bigger change than this pass; a test that holds the current bound keeps it visible instead of letting a passing suite imply it is solved |
| 2026-08-19 | The tracker ships a diagnostics report rather than a fourth speculative fix | Three rounds of inferring from a cropped screen recording produced three hypotheses and two fixture reproductions that passed. A patch-shape mismatch is still a live suspect, but shipping a matcher change on an unconfirmed theory would move the numbers before anyone had read them |
| 2026-08-19 | The report carries numbers about the pass, never frames | Match scores, patch sizes and positions are enough to tell a lost template from a bad search radius, and they keep the promise that footage never leaves the machine |
| 2026-08-19 | Entries are stored, and file blobs enter the zip by reference | Everything packed is already compressed, so deflate would cost CPU for nothing; passing Blobs rather than bytes keeps peak memory at one file, which is what makes a multi-gigabyte season bundle possible at all |
| 2026-08-19 | Clip videos are opt-in, with the cost stated in minutes | It is the difference between a 200KB file and a 2GB one, and between five seconds and twenty minutes — not a choice to make silently on someone's behalf |
| 2026-08-19 | Backwards tracking is the same pass with `dir = -1`, not a second code path | The matcher is time-symmetric; duplicating it would have doubled the surface where the v1.4 tuning could drift apart. Only the bounds, the kept-key split, the sample ordering and which end of the ring's lifetime stretches differ |
| 2026-08-19 | "The user set an end" is stored as a flag, not inferred from durations | The inference was already fragile and backwards tracking broke it outright: stretching `tStart` made an untouched end look deliberate, which would have quietly reintroduced the four-second trap for anyone who used both directions |
| 2026-08-19 | Auto-track follows until it loses him, rather than to a pre-declared end time | Requiring the end to be set first made the common case ("follow him from here") fail silently after 4s, which reads as a broken tracker. The ritual was never discoverable and no test caught it because every test performed it |
| 2026-08-19 | Multi-spotlight shares one pass and one working resolution, sized by the smallest ring | The seek+decode per frame dominates the cost, so the second player is nearly free; sizing the frame for the smallest ring keeps a far-away player matchable, and larger rings simply get larger patches |
| 2026-08-19 | Voice-overs live in IndexedDB keyed by clip id, never in the project JSON | Even a short recording is ~100KB; a few would push the project past the localStorage quota and autosave would start failing silently, losing clips and drawings. Keeping audio out of the JSON also keeps the Games-folder sidecar small |
| 2026-08-19 | The voice is cut by a decision-point freeze rather than playing through it | The freeze is a deliberate silence where he answers; narration continuing over it would both trample that moment and desync every word after it |
| 2026-08-19 | `buildFastAudio` gained an internal `returnPcm` option | The test browsers have no AAC encoder, so "did it encode" is untestable here; handing back the assembled timeline lets the suite prove numerically that the narration plays, goes quiet under a freeze, and resumes — which is the logic that can actually be wrong |
| 2026-08-19 | "Asked before / sees it now" groups by the question text, and needs two *answered* instances | The question is the stable key across games — clips differ every week. Requiring two answers keeps the section honest: one answer is a record, two is a comparison, and only the comparison tells you anything |
| 2026-08-19 | Unanswered questions are reported as "talked out loud — not lost" | Most film-session answers are spoken, not typed. A bare "3 of 8 answered" would read as the kid failing to participate when in fact the app simply was not the place he said it |
| 2026-08-18 | v2 bar: "the Grandma Test" — the next step must be visible, in plain words, on every screen | User wants an 88-year-old first-time user to succeed unaided; onboarding is a do-based tour + real tooltips, not a help wall; help modal demoted from auto-open to reference |
| 2026-08-20 | Eval clips live in a gitignored folder, never in the repo | "Footage never leaves the machine" extends to git: a push would put his games on GitHub. The harness keeps only numbers (scores, positions, times) in anything that can be committed |
| 2026-08-20 | Eval ground truth is hand-dragged spotlight keys; a second ring on the look-alike makes identity switches measurable | Manual tracking already works and produces exactly the data structure the app interpolates; a labelled decoy path turns "did it swap players" from a judgement call into a count. Requiring real separation between him and the decoy before a sample can count as a switch keeps the crossing instant itself from convicting a clean track |
| 2026-08-20 | The eval scorer stops charging position error the moment the tracker REPORTS lost, while a silent park keeps charging | Encodes the epic's invariant in the instrument: honesty must always score better than bluffing, so no future tracker can win the gate by confidently parking the ring on grass — the exact failure mode of five user reports |
| 2026-08-20 | The eval harness self-tests on fabricated paths with known answers, plus one real tracked run | An instrument that cannot catch a failure waves every change through — the fixture-gap lesson of v2.9.4 applied to the eval itself. The selftest is in npm test so the harness cannot silently rot |
| 2026-08-20 | Eval footage must be raw video, never an annotated export | Exports burn the ring into the pixels; a tracker following a painted ring is not being tested on anything. prep.sh unpacks bundles for their ground-truth JSON, and the README says to add the raw video beside it |
| 2026-08-20 | Lock-On runtime: onnxruntime-web 1.17.3 wasm-simd via blob-URL wasmPaths + YOLOX-Nano (Apache-2.0), all in one committed lockon.js | Measured, not assumed: 1.19.x cannot boot from file:// (its wasm backend's .mjs dynamic import throws Invalid URL), and 1.17.3 ignores wasmBinary but honors blob-URL wasmPaths. YOLOX-Nano is Apache-licensed (YOLOv5/v8 are AGPL), 3.66MB, and found the people in a real photo through the full embedded stack. One file via script src because fetch() of local files does not work from file:// |
| 2026-08-20 | lockon.js payloads ship gzip+base64, inflated with DecompressionStream | Halves the file (19MB → 8.5MB). Any browser new enough for the detector has DecompressionStream; one without it rejects load() and the app falls back to the built-in tracker, which is the designed degradation, not an error |
| 2026-08-20 | lockon.js is generated-but-committed, from SHA-256-pinned upstreams | No build step at use time (double-click still works), but the 8.5MB artifact is reproducible and its provenance checkable — tests/make-lockon.js re-emits it byte-for-byte and refuses a changed upstream |
| 2026-08-20 | The detector loads lazily, on first use, single-flight | The app must open instantly and mostly is not tracking; a 1.2s model boot belongs on the first Follow press, not on every launch. Failure of any kind quietly parks the state at 'absent' and the v3.7 tracker carries on |
| 2026-08-20 | Detection runs on a native-resolution crop around the play, never a downscaled whole frame | Scaling 1280px of frame into the model's 416px input shrinks a 12px player to 4px — below what any detector resolves. A 416px crop at native resolution keeps him full size; the whole-frame view is what the v3.7 working-resolution lesson already taught |
| 2026-08-20 | YOLOX input is RGB, raw 0–255 | Measured on a real photo through the exact embedded stack: RGB scores above BGR on every person, and the 0.1.1rc0 export takes unnormalized pixels. Written down because channel order is exactly the kind of silent half-wrong that still detects people |
| 2026-08-20 | Detector correctness on real players is NOT asserted by the synthetic suites | The fixtures are rectangles — a COCO-trained model rightly sees nothing in them. tests/lockon.js proves plumbing (boot, decode, NMS, fallback) on constructed answers; detection quality is the realeval harness's question, on real clips |
| 2026-08-20 | The detection path ships OFF by default, behind the real-clip gate | The epic's own rule: no tracker change lands unless the eval shows it winning on real clips — and no real clips exist yet. The code honours the gate instead of waiving it: nothing in the app turns the flag on; the eval runner does, to measure both paths on the same clips, and the flip is a deliberate one-line change recorded with the numbers |
| 2026-08-20 | Tracking-by-detection carries every nearby player as its own track; the ring is just a binding | A crossing is two tracked objects passing each other. One template getting confused was the entire failure class of v2.5-v3.7, and no amount of matching cleverness fixed it — identity comes from carrying both through |
| 2026-08-20 | Kit colour is a cliff between teams, and nothing within a team | Measured on the association unit case: as a gentle additive nudge, a clearly-different-kit detection 18px closer still won. A step penalty makes nearness unable to buy a cross-team match, while same-team sig differences stay noise-sized so geometry decides — which is the honest split: colour separates teams, only motion separates team-mates |
| 2026-08-20 | A same-kit rival within reach flags a check-this moment; the tracker never silently guesses | Phase 3(a). The report carries coalesced uncertain windows, the finish message names the first one in plain words, and per-sample confidence drops — so a wrong pick at a crossing is at worst a flagged moment, never a confident lie. The eval scorer already prices this: admitting uncertainty scores better than switching |
| 2026-08-20 | A lost run ends with one-tap resume that stitches, and the ring stays where he was last seen | Phase 3(b). "Lost him at 0:12" with a button beats a ring parked on grass in every report ever filed. The resume rides the existing keyframe model: keys outside the re-run range are kept, so tapping him simply continues the same path |
| 2026-08-20 | The hunt re-find must wear the FROZEN start-of-run kit signature | The adaptive signature has spent the occlusion learning whatever the box drifted over — the same reason v3.7's hunt uses frozen templates. Plus reachability from last-seen and found-twice-in-the-same-place, both kept from v3.7 |
| 2026-08-20 | The 25s cap is removed on the detection path only | "Follow him" means to the end of the clip — that is the epic's promise. The template path keeps its cap because changing v3.7 behaviour without the eval is exactly what the gate forbids; long.webm (40s) proves the detection path runs end to end |
| 2026-08-20 | Jersey-number OCR is deferred, not half-built | No vendorable OCR meets the offline/licence/size bar, and a guessed digit as an identity confirm is worse than no digit. Revisit only if the real-clip eval shows identity errors colour+motion cannot resolve |
| 2026-08-20 | Phase 2-3 logic is proven with a SCRIPTED detector; model quality is not | The stub feeds the real app boxes from the fixtures' own motion expressions — dropouts, crossings, permanent exits — so association, occlusion carrying, hunting, loss honesty, resume stitching and the no-cap rule are tested against answers known by construction. YOLOX-on-real-players is the one question this cannot answer, and it is the question the realeval harness exists for |
| 2026-08-23 | v6 planned: automation proposes, the human disposes — recall and mechanics automated, judgment kept by default | Choosing the moment IS the coaching (the founding guardrail), and full event-understanding from one sideline camera is research-grade anyway. A finder gated on agreeing with the moments dad already chose turns hours of scrubbing into minutes of choosing without becoming a different product |
| 2026-08-23 | Autopilot (full automation) is a user-requested, opt-in tier, draft-only, graded by human edit-distance | User asked for the full-automation option (2026-08-23). "Professional level" is defined as a measured number — corrections per draft trending to zero — not a claim. Drafts land in the reel builder; nothing exports or posts on the machine's own authority |
| 2026-08-23 | Agent involvement is metadata-first; pixels leave the machine only as per-run-approved stills, until an on-device model closes the gap (E2) | The privacy rule does not bend silently. The metadata socket (season JSON out, reel plan JSON in) gives an LLM everything judgment needs except pixels; the E1 stills tier makes any exception explicit and itemised; E2 is the end state where full autonomy and footage-never-leaves coexist |
| 2026-08-24 | First real-clip eval verdict: same-kit WIN, occlusion LOSS — detection stays off | The gate exists precisely for this: detection nearly doubles on-him time through the same-kit crossing (42.9% vs 18.2%) but collapses in the occlusion clip's camera whip (mean err 0.441 vs 0.156), re-acquiring the wrong target after an honest hunt. A mixed scoreboard does not flip a default; it hands the next session its tuning targets with numbers attached |
| 2026-08-24 | Tuning is one-change-at-a-time, and the gate reverted two of five | The first attempt applied three changes at once, improved the clip it aimed at and silently destroyed the other (42.9%→6.5%); only isolation exposed which parts helped. A roaming tile poisoning the pan estimator and a widened association gate sliding the ring onto a team-mate are both failure modes no synthetic fixture predicted |
| 2026-08-25 | The gate verdict measures time-on-him; raw coverage is not a criterion by itself | Invariant 3a at the verdict level: a wanderer scores 100% coverage with the ring on nobody, and an honest "lost him at 0:08" must beat it, never lose to it. The scorer already priced honesty into meanErr; the comparator now agrees, and the selftest holds both directions |
| 2026-08-25 | A hunt re-find after >2s unseen must be the CLEARLY nearest same-kit candidate; short gaps are exempt | Two reachable candidates in the same kit are a coin flip, and the wrong player is worse than lost. But over a short gap position memory is precise — uniqueness there killed the crowd-dropout clip (coverage 1%) — so the absence duration is the discriminator, measured on both clips |
| 2026-08-25 | Exit prediction from tracked velocity was built and removed | The velocity EMA lags an exit dash, so the last SEEN speed never forecasts the exit — the heuristic never fired on the clip it was written for. Honest exits come from refusing bad re-finds until the run ends lost, not from predicting the future |
| 2026-08-24 | Pan compensation reads only matched-pair residuals; wide passes may estimate but never commit | Estimating camera motion from unmatched tracks' nearest detections measures where the crops are, not where the camera went. And committing wide-gate matches trades the identity guarantee for coverage — the one trade this tracker must never make |
| 2026-08-24 | Recovered-ring ground truth demands the ring's exact colour signature | An orange safety vest and a referee's shirt both pass a naive yellow filter, and either one silently corrupts the truth every number rests on. G>185 ∧ R≥G ∧ R−G<70 admits #ffd60a and excludes both — verified by zero direction flips in the re-extracted path |
| 2026-08-25 | Detection tracking flipped to DEFAULT-ON (build v4.0), user-approved | The gate the epic was built around finally said yes: on parent-verified ground truth, detection beat the v3.7 template on every acceptance clip — same-kit 53.2% vs 18.2% time-on-him, pan/leaves-frame 96.4% vs 19.4% with the loss reported 0s after he exits, occlusion 52.5% vs 21.4% with an honest loss instead of confident wandering — and zero identity switches anywhere. The template tracker stays intact as automatic fallback and behind localStorage "filmroom:lockonPath"="off"; the same eval baseline now gates every future tracker change |
| 2026-08-25 | The player card's photo lives in IndexedDB; the card's JSON never carries it locally | The voice-over lesson applied before it bit: a photo as a data-URL would eat the localStorage quota autosave depends on, and a full card with photo is exactly the kind of thing that silently kills persistence months later. The folder sidecar DOES carry the photo (a real file has no quota), which is what lets the card travel between devices whole |
| 2026-08-25 | The reel card's words come from reelCardLines(), separate from the drawing | The buildFastAudio lesson: what can actually be wrong is the LANGUAGE (whose name, which roster parts, in what order), and asserting pixels tests the canvas API instead. Tests read the lines; the draw function consumes them |
| 2026-08-25 | player.filmroom.json lives in the Games folder ROOT, newest savedAt wins both ways | The card is about the player, not about any one game — pinning it to a game's sidecar would strand it on whichever video was open when it was filled in. Same conflict rule as game sidecars (newest wins, adopting says so), so there is exactly one continuity story to understand |
| 2026-08-25 | The reel plan stores clip snapshots, re-synced from the real games each time the studio opens | The plan spans games whose projects live in other browsers and folder sidecars; referencing by id alone would blank the storyboard whenever a game is elsewhere. Snapshots keep it readable, re-syncing keeps it truthful, and a vanished game marks its plays ⚠ rather than silently dropping them — losing a parent's curation because a file moved is the storyboard equivalent of a silent tracker switch |
| 2026-08-25 | Work-ons are never suggested for the recruiting reel; the draft proposes, the person decides | A recruiting reel is an argument FOR him — auto-inserting his worst moments because they were dutifully tagged would punish the discipline of honest tagging. And the draft is explicitly a starting order ("put his best play first — drag it to the top"): choosing the moment stays the parent's job, per the founding guardrail |
| 2026-08-25 | Reel Studio coaching is one contextual line, chosen by the plan's current state | The research (best play first, 3–5 minutes, end high) has to reach a parent who will never read a guide. One quiet line that changes as the plan changes teaches at the moment it applies; four static paragraphs above the storyboard would be the wall of text the spec forbids |
| 2026-08-25 | Cross-game rendering is opt-in per item on the ONE exportProgram, not a second pipeline | Every render capability (cards, freezes, audio timeline mirroring, cancel, fallback) exists once and is battle-tested; a parallel "studio exporter" would fork all of it and drift. Each extension (src, noTitleCard, noPauses, intro, tag, reframe, size) defaults to the old behavior, so the family paths are provably untouched — the backwards-tracking dir=-1 lesson applied to exporting |
| 2026-08-25 | The recruiting reel carries no coach cards and no decision-point freezes | Title cards and question freezes teach the family; a recruiting reel argues for him to a stranger with 30 seconds. The per-play context comes as a burned-in line and a 1.4s "Watch #81" freeze instead — the scout never hunts for him, and the play starts before they can look away |
| 2026-08-25 | The 9:16 crop is driven by the tracked spotlight path, smoothed and clamped | The tracking path is the only thing that knows where he is in every frame — this is why v4 shipped before v5. An exponential follow reads like a camera operator, not a jitter; proven by sampling rendered frames: the ball stays mid-frame while the source pans it across the picture |
| 2026-08-25 | The reframe follow rate is 0.08/frame, measured on the real clips, and reframe.js must match the renderer | Swept on the eval set (reframe.js): faster chases tracking noise straight out of the crop (same-kit 96.5%→90.4% from 0.05→0.4), dead-zones are worse still, and the sustained-pan clip holds 100% even at the slow end — so the calm setting wins on every axis. The checker uses the same constant so the acceptance number is about the shipped math, not a copy of it |
| 2026-08-25 | A missing game's plays are named first; the render skips them only on a second press | Silently rendering 14 of 16 planned plays is the export equivalent of a silent tracker switch — the parent finds out from a coach. The first press names what cannot be read and relabels the button with what a second press will do; nothing proceeds on the machine's own judgment |
| 2026-08-25 | The kit's chapter times come from the render's own arithmetic, never re-derived | Two implementations of "when does play 3 start" WILL drift the first time a card length changes, and a chapter that lands mid-play makes the whole description look sloppy to exactly the audience it is for. kitChapters mirrors the program math (3.0 opening, 1.4 freeze, trims); the test pins both to the same numbers |
| 2026-08-25 | The player page is one file with everything inlined, hosted nowhere by us | A parent's hosting story is "attach it to the email" or "drag it onto any free host" — a page with external assets breaks in the first case and rots in the second. Data-URI photo + poster keep the promise the app has always made: nothing leaves the machine until the parent sends it |
| 2026-08-25 | The app stays dark; the outward artifacts (player page, cards, exports) are the light surface | A film room is dark for the same reason a cinema is — the footage is the bright thing. Retrofitting a second in-app palette would double the AA audit surface for a mode nobody asked for, while the things a stranger sees (the coach's email attachment, the player page) already got the considered light treatment. If a light mode is ever wanted, it is a deliberate future decision, not a checkbox |
| 2026-08-25 | Studio motion is one curve, one duration, and off under prefers-reduced-motion | Micro-interactions read premium only when they are uniform — five different easings read as jitter. One 140ms ease-out for state changes, one 220ms rise for entering cards, and the media query turns all of it off for anyone who asked their OS for less motion |
| 2026-08-25 | New surfaces enter the contrast audit the day they ship | comfort.js now opens Reel Studio with a real plan rendered before auditing. The v2 lesson (an audit that does not walk a screen silently exempts it) applied while the paint is wet, not after a regression |
| 2026-08-25 | The ball rides the same inference and is invisible to player logic except through one filter | Class 32 comes out of the tensor the model already ran, so ball detection is free at decode time; kind:'ball' plus a single filter in detsAt means the entire v4 identity machinery is provably untouched — measured bit-identical player metrics on all three real clips with the ball on |
| 2026-08-25 | The ball gets one dedicated magnified look per step; coverage numbers published honestly | Measured: a ~10px blurred ball is invisible to YOLOX-Nano in a 416 crop, and even 4× magnification finds nothing in the same-kit crowd (probed to threshold 0.03). A tighter crop at the ball's predicted spot (else his feet) lifted near-play coverage 17.7→31.3% pan, 0→9.7% same-kit, players unchanged. Recorded conclusion: possession is a sometimes-signal on real youth footage — the Moment Finder must treat it as one voice among several, never the backbone |
| 2026-08-25 | A ball is only ever RECORDED when seen; a GT ring labelled "ball" is never him and never a decoy | A coasted ball is a guess and everything downstream (possession, moments) would inherit the guess — the honest-loss invariant applied to a second object. And counting the ball ring as a look-alike would fabricate identity switches in the eval, corrupting the very numbers the gate reads |
| 2026-08-25 | The Moment Finder is pure over the tracking report; the gate replays the SHIPPED arithmetic in the real page | Purity is what makes the gate honest: realeval/moments.js grades the exact candidates a user would see, against games broken down by hand, with no second copy to drift (the kit-chapters lesson). It also makes the whole finder testable on constructed traces where the right answer is known |
| 2026-08-25 | The sprint threshold is adaptive above a floor; a quiet game yields nothing | "Fast for HIM in THIS game" is the right question (a U11 sprint is not a U17 sprint), but a pure percentile would crown the 85th percentile of strolling in a boring half. max(floor, p85) means excitement is never invented — the empty state says a quiet half can be honest |
| 2026-08-25 | Box entries and true recovery runs are OUT of the finder's v1, said plainly | Both need pitch geometry a single sideline camera does not provide. Faking them from frame position would produce confident nonsense at exactly the moments a parent trusts the label — sustained sprints stand in as "a long hard run" until geometry exists, and the spec text stays in the workstream for when it does |
| 2026-08-25 | Rejections are counted, never learned from; accepted clips name their provenance | Predictability is a feature: a finder that silently reweights after every "no" becomes unexplainable within a week. The counts are shown to the user in the tally ("the counts are only counts"), and an accepted clip's notes say the scan found it — choosing stays visibly the human's |
| 2026-08-25 | Auto-Cut proposes only WITHIN the clip, and null is a first-class answer | Extending a clip touches footage the parent never chose to include — a different decision than trimming quiet air. And a proposal that always exists becomes noise: no coverage, too short, already tight are all "stay quiet", so the ✂ button's mere presence carries information |
| 2026-08-25 | Auto-Cut's gate widens his clips 3s per side and re-tightens them | His hand-set trims are the only professional-grade cut data that exists for this footage. The widen-then-tighten experiment measures the exact question ("would the assist land where he did, starting from a loose cut?") without needing anyone to produce new ground truth |
| 2026-08-25 | The speed-ramp is carried on the clip (c.ramp), never applied by the assist | A ramp is a taste decision for a social cut, not a trim. Storing the fastest stretch as data lets the studio's social render offer it later, while accepting a tighten today changes nothing about playback speed — one proposal, one meaning |
| 2026-08-25 | The metadata export carries the reel plan by reference, never a copy of the pool | Ids + trims + toggles are the plan; duplicating clip content into it would let the two copies disagree by the next edit. The importer resolves references against the live pool, so a plan is always shown against the season as it IS — and a play this browser cannot see is marked, exactly like the storyboard's missing semantics |
| 2026-08-25 | The socket refuses newer versions instead of guessing at them | A version-99 reelplan probably carries fields this build has never heard of; half-importing it would show a draft that silently dropped the Autopilot's decisions. "Update the app first" is the only honest answer, and the version field exists precisely so it can be said |
| 2026-08-25 | No pixels in the metadata file — the photo stays home | filmroom-metadata.json is the E0 boundary made literal: an Autopilot reading it can know everything the family WROTE and nothing the camera SAW. The export is tested to contain no data: URI so the boundary cannot rot silently |
| 2026-08-25 | The Autopilot's report card is measured by the APP, never self-graded by the session | A model asked "how good was your draft?" will answer optimistically and honestly believe it. The app fingerprints every imported plan and counts the human's actual corrections (removals, additions, LCS reorders, re-trims, retitle) into the next metadata export — the ledger the epic's "fully capable" definition reads |
| 2026-08-25 | AUTOPILOT.md's promises are asserted by the test suite | "Draft-only" and "never posts anywhere" are worthless as vibes in a doc nobody re-reads. tests/autopilot.js greps the document for its own hard rules, so weakening the contract breaks the build — the jargon-ban lesson applied to a safety promise |
| 2026-08-25 | The headless renderer does one game per run and refuses more, toward the app's own button | Serving multi-game footage into a headless page means base64-ing gigabytes through an init script — a memory cliff dressed as a feature. The app's real 🎬 button with the real Games folder already renders multi-game plans; the driver says so instead of half-working |
| 2026-08-25 | The default ending of an Autopilot run is the PARENT pressing Make the reel | Even with a perfect draft, the render click is where review actually happens — the drag-what's-wrong moment. The headless render exists for the explicitly-asked hands-off case and still only writes "DRAFT - " files that never overwrite anything |
| 2026-08-25 | v7 "Onyx" recolors chrome only — PALETTE, drawScene() and the export/title-card renderers are frozen | Overlay and export share one renderer, and title cards are burned into saved files: restyling them would make every previously exported video mismatch the editor. On the new neutral-gray workspace the untouched vibrant annotations become the loudest thing on screen — which is the product's point. Chroma in the UI is budgeted to selection, live state, in/out + playhead, clip-rating data, and the one primary action per screen |
| 2026-08-26 | On a phone the vault (IndexedDB) is the real store and localStorage is a cache | iOS clears script-writable storage for idle sites and caps localStorage at ~5MB. Mirroring every save keeps the sync read paths (and every existing test) working while making the work actually durable — a rewrite to async storage would have touched every render path for no user-visible gain |
| 2026-08-26 | A game is identified by size and length, not by its file name | The Photos picker can rename or re-encode the same video, and the old name:size key read that as a new game — silently orphaning every clip. Size match is conclusive; length within 0.35s is close enough to offer. A different video is never adopted, which the suite asserts |
| 2026-08-27 | Pages was live the whole time; the plan said otherwise for nine days | Four spots (three in this file, one in the README) recorded "Pages still needs enabling — nobody has confirmed it deploys" while 31 successful deployments had already run. A stale doc is worse than no doc: it was quoted back as fact and sent the user to flip a switch that was already on. Deployment state is now verified from the Actions API when it matters, not read from this file |
| 2026-08-27 | Phone top bar scrolls sideways in one row; nothing collapses into icons | Wrapping ate half an iPhone screen, but the Grandma-Test rule (plain words over icons) forbids the usual icon-only compaction. The board and compare bars already scroll horizontally, so the pattern was in the house style. Below 640px the 📦 Project popover becomes a fixed sheet measured off the live bar height — bigText and a notch outgrow any hardcoded offset |
| 2026-08-27 | The panel-sheet tuck is raised by a USER tap on a tab, never by programmatic tab switches, and is not persisted | Saving a clip switches to the Clips tab in code; if that raised the sheet, every save would undo the tuck the parent chose seconds earlier. And a remembered tuck across visits would greet them with a missing panel and no memory of hiding it — the tuck is a this-viewing choice |
| 2026-08-27 | Rotating the phone IS the watch gesture: landscape hides the top bar and auto-tucks the panel | The bar's jobs (open, export, help) are portrait jobs; sideways exists to see the film. Everything returns on turning upright or tapping a tab, and a one-time hint says so — hiding chrome is safe only when the way back is the same motion that hid it |
| 2026-08-27 | Pinch zoom is a view transform on the wrap, never a change to coordinates or exports | evNorm() reads getBoundingClientRect(), which already reflects CSS transforms — so drawing stays exact at any zoom with zero new math, and drawScene/export code paths are untouched. A second finger unwinds what the first started: zooming must never leave an accidental ring behind |
| 2026-08-27 | Sideways chrome OVERLAYS the film; nothing stacks below it — and icon-only buttons are allowed on the thumb rail | Stacked strips left the landscape picture smaller than portrait on a real iPhone once Safari took its share; every strip now floats translucent over the film. The rail breaks the plain-words rule deliberately: it is an accelerator whose worded twin (the toolGrid) is one 🧰 tap away, and each rail button carries a full-sentence tip — the same bargain ⌘K made |
| 2026-09-05 | Audit finding kept as a test: the real model's detection path is proven on `feet.webm` in `tests/lockon.js`, tolerance 0.03 | The suite proved the fallback with the real model and the detection path only with a scripted detector — nothing asserted that the real model ever binds a ring and holds a player. The one body-shaped fixture measures 0.011 worst, so 0.03 catches a real regression without flaking; it is a regression check, never a real-footage conclusion (that gate stays `realeval/`). Also recorded, unchanged: `APP_BUILD` still stamps v6.0, backward detection runs have no 25 s cap, `c.ramp` is stored but never rendered |
| 2026-09-05 | The hunt runs 30 s, and past 5 s the reach opens to the whole frame but the candidate must be the ONLY unassigned wearer of his kit in one full-frame look | Five seconds of hunting ended most real losses with a tap from the parent. Position memory is what made a short reach honest, and after a few seconds it is stale — so the far rule stops trusting distance and trusts uniqueness instead — measured in ONE step's whole-frame detection, so his own motion between steps can never make him look like two people. Two wearers anywhere means no answer, which is the epic's invariant (never a silent switch) stated for long absences. Gated on the real clips like every tracker change |
| 2026-09-05 | A re-find after ≥ 2 s records a GAP on the ring and nothing is drawn inside it; the resume records the tapped-over stretch the same way | Linear interpolation across a long absence draws the ring gliding over ground he was never seen on — the same bluff the tracker refuses everywhere else. Under 2 s the glide matches the accepted coasting behaviour and hiding would only flicker; over it, honesty wins. Stored as an optional field so old projects load unchanged and drawScene serves overlay and export alike |
| 2026-09-05 | A resumed run JOINS the previous report instead of replacing it | The Moment Finder and Auto-Cut read one report; with every resume replacing it they only ever saw the last segment of a game. Joining is what lets one scan plus a few taps cover the whole game — and `stitched` in the report says how many taps it took |
| 2026-09-05 | "Make his reel" drafts and orders, but never saves | The v6 rule stands — choosing the moment is the coaching — but the cost that rule had was a click per moment and per clip. Ranking by the finder's own score, the studio's order (best first, end on a high) and the auto-cut trim are mechanics, not judgment. The parent's judgment is now one look and one Save, with one Undo |

## Working agreements for future sessions

- Develop on the designated feature branch; run `tests/` smoke suite before pushing.
- Keep `index.html` self-contained — no external requests, no libraries.
- Update this file (feature checkboxes, decision log) as part of any feature commit.
- Preserve backward compatibility of the project JSON (`version` field exists for
  migrations if the schema must change).
