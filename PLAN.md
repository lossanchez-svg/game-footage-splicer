# Film Room — Product Plan & Roadmap

This is the source of truth for where the project is and where it's going.
**Keep it updated**: when a feature lands, check it off; when a decision is made, log it.

## ▶ Start here (next session)

You are picking up a working, fully-tested product. Before writing any code:

1. Read `CLAUDE.md` (conventions, test workflow) and this file top to bottom.
2. **The v2 “Grandma Test” epic is complete** (all six workstreams — see the section
   below, kept as the record of what was built and why). The next work is the
   **Roadmap → Next** list: cross-device continuity via the Games folder, then tracker
   tuning once there is real-footage feedback.
3. **Before starting anything new, ask the user how the v2 onboarding actually landed.**
   The epic's whole premise is a person who has never seen the app; only they can say
   whether the walkthrough, the tooltips and the watch banner survived contact with a
   real first-time user. Screenshots of the current flow: `cd tests && node walkthrough.js`
   writes `tests/out/walk_*.png`.
4. Non-negotiables: single self-contained `index.html`, zero dependencies, works from
   `file://`, footage never leaves the machine. Run the full test suite in `tests/`
   (`npm test`, see `tests/README.md`) before every push; add suites for new behavior.
   The suite is 251 checks across 15 files and takes a few minutes.
5. Update this file (checkboxes + decision log) as part of every feature commit.

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
- [ ] Whole-video fast export of a long game: progress is fine but there's no
      time-remaining estimate; add one (seek pace is measurable after ~5s).
- [ ] Board: no undo *within* a chip drag (each drag is one undo step — verify feel).
- [ ] PWA: verify installed-app behavior on a real iPad (icon, offline, orientation).
      GitHub Pages still needs enabling on the repo (Settings → Pages → main) — that is
      the iPad "Add to Home Screen" path, and nobody has confirmed it deploys.
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

## Working agreements for future sessions

- Develop on the designated feature branch; run `tests/` smoke suite before pushing.
- Keep `index.html` self-contained — no external requests, no libraries.
- Update this file (feature checkboxes, decision log) as part of any feature commit.
- Preserve backward compatibility of the project JSON (`version` field exists for
  migrations if the schema must change).
