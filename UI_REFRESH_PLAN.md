# Film Room — UI Refresh Audit & Execution Plan

**Status: PLANNING DOCUMENT ONLY. No code has been changed.**
This is the audit + sprint proposal for the "Onyx re-skin / intent-driven invocation /
progressive disclosure" refresh. It was produced by reading the whole UI layer
(`index.html` CSS lines 14–499, markup lines 501–1208, script lines 1209–8831) plus
`PLAN.md`, `CLAUDE.md`, and the test suite. Review it, then hand it to the execution
session sprint by sprint.

---

## 0. Reality check — mapping the brief onto what Film Room actually is

The brief is written in the vocabulary of a multi-track NLE. Film Room is not one: it is
a single-video **annotation and film-study** tool (one `<video>`, a drawing overlay
canvas, a seek-bar timeline with clip *markers*, a clip library, and renderers that burn
annotations into exports). Several requested concepts therefore have no substrate to
re-skin, and per the functional guardrail ("re-skin, layer, optimize access paths — do
not add or remove capability") they are mapped to their nearest real equivalent or
explicitly marked N/A rather than invented:

| Brief concept | Film Room reality | Plan disposition |
|---|---|---|
| Timeline clip wrappers | `.tlClip` marker bars in the seek bar (`#tlClips`, index.html:150–152, renderer at :2008) | ✅ Re-skin as tangible blocks (Sprint 2) |
| Audio track waveforms | **No audio tracks, no waveforms exist.** Audio is muxed at export only | ⚠️ N/A as re-skin. An optional audio-energy strip is listed as Stretch S-A (new feature, off the critical path, needs user sign-off) |
| Multi-cam / synchronized layers | No multi-cam. Nearest: ⚖ Compare (two videos side by side, :563–596) | ✅ Smart-drop targets Compare's "example side" instead (Sprint 5) |
| Transitions / global effects on drop | No transition or effect system exists | ❌ Out of scope — would be a new feature, not an access path |
| Voice enhancement / trim silence | Nearest real tools: 🎤 voice-over (:1051), ✂ "Tighten to the action" (:4754), clip loop | ✅ These are what the contextual menu surfaces (Sprint 4) |
| Scale / Position / Opacity properties | No transform properties. Nearest: a drawing's label, color, visible-range vs. its tracking/ring controls | ✅ Two-tier split of `#selSection` (Sprint 6) |
| Keyframe timelines, anchor points, blending modes | Only spotlight position keyframes exist (`spot.keys[]`); no blend modes | ✅ Tracking controls become the "advanced" tier; nothing removed |
| Cmd/Ctrl+K command bar | Nothing like it exists; all actions are buttons with `data-tip` sentences | ✅ Build it (Sprint 3) — the `data-tip` corpus is a ready-made search index |

Two project-level constraints from `PLAN.md` override any styling instinct:

1. **The Grandma Test is shipped, tested, and non-negotiable** (PLAN.md "v2" epic):
   plain words, one visible next step, AA contrast, big touch targets. `tests/tips.js`
   fails the build if any reachable control lacks a full-sentence jargon-free tip;
   `tests/plainwords.js` sweeps every surface for jargon; `tests/comfort.js` runs a
   real WCAG-AA computed-style contrast audit over eight screens in both text sizes.
   Every new component in this plan must ship with `data-tip` sentences and pass all
   three suites.
2. **Single-file, zero-dependency, `file://`** — no icon fonts, no CSS frameworks, no
   command-palette libraries. Everything below is plain CSS/JS inside the one
   `<style>`/`<script>` pair.

---

## 1. Architectural map (where everything lives)

One file, `index.html` (~8,830 lines). All modification targets for this refresh:

```
index.html
├─ <style>            lines   14–499   ← Sprint 1 & 2 (theme, timeline, borders)
│   ├─ :root tokens          15–20     ← THE theme surface: --bg/--bg2/--bg3/--line/…
│   ├─ base controls         21–49     ← buttons, inputs, focus rings, scrollbars
│   ├─ top bar               51–63
│   ├─ stage & overlays      65–142    ← decision/busy/board/compare/session/trackPill
│   ├─ transport & timeline 144–162    ← #timeline, .tlClip, .tlAnn, #playhead, #tlInOut
│   ├─ sidebar & panels     164–237
│   ├─ modals               210–265
│   ├─ Reel Studio tokens   267–336    ← the ONLY second token set (--st-*); the model
│   │                                    for how to introduce scoped tokens cleanly
│   ├─ misc epics           338–475    ← trends, watch banner, adv disclosure, tips, tour
│   └─ touch/small/safe-area 477–498
├─ <body> markup       lines  501–1208
│   ├─ #topbar               504–531   ← 14 top-level buttons (Sprint 6 clustering)
│   ├─ #stage + mode bars    544–625
│   ├─ #transport            628–668   ← timeline + controls + Advanced disclosure
│   ├─ #sidebar 3 tabs       673–909   ← Draw / Clips / Coach panels
│   └─ modals                912–1207
└─ <script>            lines 1209–8831
    ├─ PALETTE (annotation colors)     1226   ← burned into exports — DO NOT desaturate
    ├─ toast/persist/undo/mutate       1282–1367
    ├─ document drag-drop              1378–1394  ← Sprint 5 hook point
    ├─ transport + timeline seek       1975–2006  ← pointer-capture scrub
    ├─ renderTimelineMarks()           2008–2035  ← Sprint 2 & 4 hook point
    ├─ drawScene() + overlay tools     2132–2478  ← EXPORT-SHARED; theme must not touch
    ├─ setTool/colors/sel panel        2479–2560
    ├─ renderAnnList()                 4537
    ├─ renderClipList()                4719–4808  ← 9-button cards; Sprint 4 refactor
    ├─ renderReelList()                4814       ← ↑/↓/✕ reorder buttons
    ├─ board / compare                 5279–5560
    ├─ global keydown                  6898–6944  ← Sprint 3 hook point
    ├─ tick() rAF loop                 6947
    ├─ Reel Studio storyboard drag     7561–7700  ← existing pointer-drag reorder model
    └─ tooltip engine (hover+longpress) 8600–8700 ← long-press is TAKEN (tips)
```

**Load-bearing invariants** (verified in code, restated from CLAUDE.md):

- `drawScene(ctx, W, H, t, opts)` renders annotations for **both** the live overlay and
  full-resolution export. The theme refresh recolors *chrome only*; `PALETTE`
  (`:1226` — `#ffd60a #ff453a #0a84ff #30d158 #ff9f0a #ffffff #bf5af2 #64d2ff`) and
  everything `drawScene` paints must be untouched, or every previously exported video
  stops matching the editor.
- Every state change goes through `mutate()` (`:1361`) — new accelerated pathways must
  call the *same* action functions the buttons call, never duplicate mutations.
- Project JSON stays backward compatible; nothing in this plan touches the data model.
- `body.bigText`, `@media (pointer:coarse)`, and `prefers-reduced-motion` each have
  dedicated rule blocks — every new component needs entries in all three.

---

## 2. Area 1 — Look & feel: "Onyx Matte" dark mode

### 2.1 Current state (audit)

The theme is a GitHub-Dark derivative, defined once at `index.html:15–20`:

```css
:root{
  --bg:#0d1117; --bg2:#161b22; --bg3:#1f2630; --line:#2d333b;
  --text:#e6edf3; --dim:#8b949e; --accent:#2ea043; --accent2:#58a6ff;
  --pos:#3fb950; --neg:#f85149; --neu:#8b949e; --warn:#d29922; --accent-btn:#1a7f37;
  --radius:8px;
}
```

Findings:

- **Blue-cast, not matte.** All four surface grays carry a blue chroma (hue ≈ 215°).
  "Onyx" means neutral grays in the #121212–#1A1A1A band; this is a token swap, not a
  rewrite — the app is already ~95% token-driven.
- **Accent leakage.** The brand green/blue appear in *decorative* positions that the
  brief says must go monochrome: the logo `span` (:55), the active-tab underline (:170),
  `#tourBubble` accents, the watch-banner green gradient (:391), the `#sessionBar`
  green border (:124), `#trackPill` blue border (:141). Meanwhile the *earned* accent
  positions (playhead, selection, live-render state) are partly monochrome today: the
  playhead is plain white (:157).
- **Hardcoded off-token colors** that will betray the re-skin if missed (grep-verified
  inventory): `#2b3340` (button hover, :33), `#79c0ff` (focus rings, :45–47),
  `#04121f` (on-accent text, :38/:183/:461), `#333c48` (scrollbar, :49),
  `rgba(4,8,15,…)` scrims (:83, :92, :212, :417), `#f0f6fc/#0d1117` (tip bubble, :411),
  `#15301d→#161b22` (watch banner gradient, :391), `#c9d1d9` (coach/quote text,
  :232/:382), `#132540` (toast button hover, :469), `#5c1f1f` (danger hover, :39),
  Reel-Studio scoped tokens `--st-card:#161d27; --st-card-edge:#232c38` (:275–276) and
  `#31547a`/`#57d06d` (:292/:321), plus inline `style="color:var(--dim)"` usages in
  markup (all already tokenized — fine) and `#2ea043`-adjacent greens `#1c883b` (:37).
- **Semantic rating colors are data, not chrome.** `--pos/--neg/--warn` color the clip
  rating system (👍/🔧/💡) on timeline bars (:2012), clip dots (:4728), and KPI bars.
  A "strictly monochrome workspace" must exempt them — they carry meaning the family
  reads at a glance — but they can be *tonally tuned* to sit quietly on Onyx.
- **Contrast is enforced by tests**, not by hope: `tests/comfort.js` computes real
  WCAG-AA ratios over eight screens in both text sizes. It is the acceptance gate for
  every token below.

### 2.2 Target token set (exact changes, `index.html:15–20`)

```css
:root{
  /* Onyx surfaces — neutral, matte, #121212–#1A1A1A dominant band */
  --bg:#121212;        /* was #0d1117 — page + timeline well + inputs */
  --bg2:#171717;       /* was #161b22 — top bar, transport, sidebar, modal boxes */
  --bg3:#1e1e1e;       /* was #1f2630 — cards, buttons, chips (raised surfaces) */
  --bg-raise:#242424;  /* NEW — hover state of raised surfaces (replaces #2b3340) */
  --line:#2c2c2c;      /* was #2d333b — the 1px dimensional border, per spec */
  --line-soft:#232323; /* NEW — nested/secondary separations */
  --edge-hi:rgba(255,255,255,.055); /* NEW — 1px inner top-edge highlight (skeuomorph) */
  --shadow-pane:0 0 0 1px var(--line), 0 8px 24px rgba(0,0,0,.35); /* NEW */

  --text:#ececec; --dim:#9e9e9e;          /* neutralized; #9e9e9e on #1e1e1e ≈ 5.7:1 AA ✓ */

  /* chroma budget — allowed ONLY on: playhead & in/out range, selection borders,
     live-state indicators (record/track/export), and primary action buttons */
  --accent:#2ea043; --accent2:#58a6ff; --accent-btn:#1a7f37;   /* values unchanged */
  --pos:#3fb950; --neg:#f85149; --neu:#9e9e9e; --warn:#d29922; /* data colors — keep */
  --radius:8px; --radius-clip:6px;         /* NEW — timeline clip blocks (4–8px band) */
}
```

Verification duty for the executor: run `tests/comfort.js` after the swap; `--dim` is
the only ratio near the line — if any screen fails, lighten `--dim` toward `#a6a6a6`
before touching anything else.

### 2.3 Monochrome sweep — where chroma is removed vs. kept

**Demote to monochrome** (each is a one-line CSS change; file:line given):

| Element | Today | Onyx treatment |
|---|---|---|
| Logo `span` (:55) | brand green | `color:var(--text)`; weight carries the brand |
| Active tab underline (:170) | green bar | `border-bottom-color:var(--text)` |
| `#buildTag` (:56) | outlined pill | unchanged structure, `--line` border (already) |
| Watch banner (:391) | green gradient | flat `--bg2`, `--line` bottom border; the **Start watching** primary button keeps the green — the accent *is* the call to action |
| Coach/quote text `#c9d1d9` (:232, :382) | tinted gray | `var(--text)` at 90% opacity or `#d6d6d6` |
| Tip bubble (:411) | near-white blue `#f0f6fc` | `#f2f2f2` / text `#141414` (stays inverted for pop) |
| Scrollbars (:49), scrims (:83 etc.) | blue-gray | neutral (`#2e2e2e`, `rgba(0,0,0,.66)`) |
| Reel Studio `--st-card/--st-card-edge` (:275) | blue-tinted | `#191919` / `#292929`; hover border `#31547a` → `var(--line)` + shadow lift |

**Keep / concentrate chroma** (the "chrominance isolation" list):

- `#playhead` (:157): **becomes accent-colored** — 2px `var(--accent2)` with a soft
  `box-shadow:0 0 6px rgba(88,166,255,.6)` glow. This is the single most-watched pixel.
- `#tlInOut` (:155): stays blue — it is literally "clip selection in progress".
- Selection borders: `.annItem.selected` (:192), `.colorChip.active` (:180),
  `button.active`/`.chip.active` — stay `--accent2`.
- Live-state indicators: `#trackPill` (blue border, :141), `.voiceDot` recording pulse
  (:244), `#busyBarFill` export progress (:96), `#sessionBar` (green, :124) — all keep
  their color; they are exactly the "real-time rendering state" class the brief names.
- Primary buttons (`.primary`, :36) keep `--accent-btn` green — PLAN.md's "one obvious
  primary action per screen" *depends* on this being the only loud button.
- Annotation `PALETTE` (:1226) and all `drawScene` output: untouched. On a monochrome
  workspace the vibrant on-video annotations become the loudest thing on screen —
  which is the entire point of the product.

### 2.4 Skeuomorphic depth & dimensional borders

- **Timeline clip blocks** (`.tlClip`, :152): raise from flat 3px-radius strips to
  tangible blocks — `border-radius:var(--radius-clip)` (6px, inside the mandated
  4–8px band), a `linear-gradient(rgba(255,255,255,.10), rgba(0,0,0,.18))` overlay on
  the rating color, `box-shadow:inset 0 1px 0 var(--edge-hi), 0 1px 2px rgba(0,0,0,.5)`,
  `opacity:1` (drop the current .85), and a hover lift (`filter:brightness(1.15)`).
  `#tlClips` height 20px→22px so the blocks read as objects. Gradient painting stays
  CSS-only — `renderTimelineMarks()` (:2008) needs no logic change, only class hooks.
- **Pane separations**: `#sidebar` (:165), `#transport` (:145), `#topbar` (:53) keep
  their 1px `--line` borders (now #2C2C2C per spec) and *add* a directional shadow so
  edges read as depth, not lines — e.g. `#sidebar{box-shadow:-8px 0 20px rgba(0,0,0,.25)}`,
  `#transport{box-shadow:0 -6px 16px rgba(0,0,0,.25)}`. The `#stage` stays pure `#000`
  (footage must not sit on a gray).
- **Cards** (`.annItem/.clipItem/.kpi/.sbCard`): add `inset 0 1px 0 var(--edge-hi)` —
  a single shared rule keeps it one decision, not twelve.
- All new motion/shadows get `prefers-reduced-motion` entries next to the existing
  block at :332.

**Waveforms (Stretch S-A, not in the sprint path):** there are no audio tracks to
gradient. If wanted later: decode a coarse energy envelope via `AudioContext.
decodeAudioData` on the loaded file, downsample to ~2 px/s, and paint a low-opacity
strip into `#tlAnns`'s band. Flagged stretch because 90-minute game files make
`decodeAudioData` memory-expensive on iPad — needs a real-footage feasibility spike
first (the PLAN.md "measure before building" lesson applies).

---

## 3. Area 2 — Intent-driven invocation (zero-loss triggers)

### 3.1 Current interaction audit

- **Timeline** (`:1997–2006`): pointer-capture scrub-to-seek on the whole strip. The
  `.tlClip`/`.tlAnn` marker bars are **inert** (native `title` only — invisible on
  iPad); clips can only be operated from the sidebar Clips tab. This is the single
  biggest "menu-diving" cost in the app: see a clip on the timeline → find it again in
  a list.
- **Drag & drop** (`:1378–1394`): one whole-document target; picks the first
  video-looking file, else a `.json/.filmroom` project, with excellent failure toasts.
  No zones.
- **In-app drag**: Reel Studio storyboard cards reorder via `⠿` pointer-drag
  (`:7669–7700`) — this is the proven in-file drag pattern to reuse. The weekly reel
  list reorders via ↑/↓ buttons only (:4827–4829).
- **Keyboard** (`:6898–6944`): full transport/tool map (Space/K, ←/→, J/L, I/O, Enter,
  1–6, [/], Delete, ⌘Z, ?, Esc cascade). `⌘/Ctrl` combos other than Z are explicitly
  released to the browser (`:6922`). **Cmd+K is free.**
- **Long-press is occupied**: the tooltip engine (`:8682–8695`) owns touch long-press
  app-wide and deliberately swallows the click. Any touch pathway for new menus must
  NOT use long-press.

### 3.2 (a) Contextual micro-menu (timeline clip hover)

A single reusable floating micro-menu (`#microMenu`), shown on `pointerenter` over a
`.tlClip` block (150ms intent delay), positioned above the bar near the cursor, fading
in 120ms. It exposes the clip's *existing* actions by delegating to the same handlers
the sidebar uses.

**Prerequisite refactor (zero behavior change):** extract the nine inline closures in
`renderClipList()` (`:4757–4803`) into a dispatcher —

```js
/* one source of truth for everything you can do to a clip; the sidebar buttons,
   the micro-menu, and the command bar all call this */
function clipAction(act, c){
  switch(act){
    case 'play':    return playClip(c);
    case 'export':  return doExport(c.tIn, c.tOut, c.title, c);
    case 'reel':    return toggleReel(c);      // lifted from :4775
    case 'board':   return openClipBoard(c);   // lifted from :4785
    case 'compare': return openCompare(c.id);
    case 'voice':   return openVoice(c);
    case 'edit':    return openClipModal(c);
    case 'tighten': return tightenClip(c);     // lifted from :4759
    case 'del':     return deleteClip(c);      // lifted from :4798
  }
}
```

**Menu content is contextual** by clip state (the "media type" equivalent here is the
clip's rating + attachments): always `▶ Play · ✏️ Edit · ➕/✓ Reel`; adds
`✂ Tighten to the action?` only when `proposeCut()` has a proposal (the existing
smart action, :4754), `🎤` marked ✓ when a voice-over exists, `🗒` ✓ when a board is
linked. Structure:

```html
<div id="microMenu" role="menu">
  <div class="mmTitle"></div>   <!-- clip title + rating dot, so you know what you hit -->
  <div class="mmRow"></div>     <!-- miniBtns built from clipAction registry -->
</div>
```

```css
#microMenu{position:fixed; z-index:90; display:none; background:var(--bg3);
  border:1px solid var(--line); border-radius:10px; padding:6px 8px;
  box-shadow:var(--shadow-pane); animation:mmIn 120ms var(--st-ease);}
@keyframes mmIn{from{opacity:0; transform:translateY(3px)} to{opacity:1}}
@media (prefers-reduced-motion:reduce){ #microMenu{animation:none} }
```

Rules that keep it zero-loss and Grandma-safe:
- Pure addition: seek-on-click on the timeline is preserved (the menu floats above the
  strip; moving onto the menu keeps it open, leaving both closes it).
- Every menu button carries the same `data-tip` sentence as its sidebar twin
  (`tests/tips.js` audits reachable controls).
- **Touch:** hover doesn't exist and long-press is taken by tooltips, so on
  `pointer:coarse` the menu is not offered — the sidebar path remains the touch path.
  Documented, not hacked around.
- Radial layout was considered and rejected: a linear row reuses `.miniBtn` styling,
  reads left-to-right like the rest of the app, and doesn't obscure the timeline under
  the cursor. (The brief allows "hover/radial"; hover-linear is the fit here.)

### 3.3 (b) Semantic smart-drop zones

Layer zones over the two real drop intents the app has, keeping today's whole-document
behavior as the fallback everywhere else (zero-loss):

1. **File drag from the OS** — on `dragenter` with files, show a zone overlay on
   `#stage`:
   - **Center (dominant): "Open as this game"** → existing `loadVideo(f)`.
   - **Right edge: "Use as the example side (Compare)"** → existing Compare "model"
     file path (`#cmpFile` handler) — the app's real "second synchronized video" —
     only offered when a video is already loaded.
   - Project files (`.json/.filmroom`) auto-detect exactly as today; the overlay
     labels the whole stage "Load this project".
   A drop anywhere outside the zones behaves exactly like today's document handler,
   and every current failure toast (:1388–1392) is kept verbatim — those toasts are a
   PLAN.md-documented standard ("the drop-feedback fix is the model").

```css
#dropZones{position:absolute; inset:0; display:none; z-index:45; pointer-events:none;}
.dz{position:absolute; border:2px dashed var(--line); border-radius:12px; margin:10px;
  display:flex; align-items:center; justify-content:center; color:var(--dim);
  font-size:15px; background:rgba(18,18,18,.55); transition:border-color 120ms, color 120ms;}
.dz.hot{border-color:var(--accent2); color:var(--text);
  background:rgba(88,166,255,.08);}   /* accent = live selection state: allowed chroma */
```

   Implementation: `dragenter/dragleave` counter on `document` toggles `#dropZones`;
   `dragover` hit-tests `e.clientX/Y` against zone rects (`pointer-events:none` keeps
   the underlying drop handler authoritative); `drop` reads the active zone and routes.
2. **Clip cards → weekly reel** — make `.clipItem` draggable by a `⠿` handle (reusing
   the storyboard drag pattern at :7669) onto the "🎞 Highlight reel" section, which
   highlights as a drop target and calls the same `clipAction('reel', c)`. The ➕ Reel
   button and ↑/↓ reorder buttons remain untouched (they are the touch path and the
   tested path).

"Left boundary = transition, center = effect, audio-onto-video = multicam" from the
brief have no corresponding capabilities — no zones are built for them (see §0 table).

### 3.4 (c) Command bar (⌘K / Ctrl+K)

A global palette that types-to-run any existing command. Zero new capability — it is a
router over the buttons that already exist.

**Action registry:** built at boot by walking a small static list of
`{el:'#btnExport', name:'Save video', extra:'export clip mp4 tv'}` entries plus
per-clip dynamic entries (`Play "Great scan → line-breaking pass"`). Each entry's
searchable text = visible label + its `data-tip` sentence (already plain-language,
already describes *when you'd use it* — a ready-made semantic index, no NLP needed).
Executing an entry literally calls `el.click()` (or `clipAction`), so availability,
guards (`needVideo()` etc.), and `mutate()` flows are inherited, never duplicated.

```html
<div class="modal" id="cmdModal" style="z-index:85">
  <div class="box" style="width:min(560px,94vw); padding:10px">
    <input id="cmdInput" type="text" placeholder="Type what you want to do…"
      data-tip="Type a few letters of anything Film Room can do — like “save video” or “board” — and press Return to do it. Esc closes this.">
    <div id="cmdList"></div>
  </div>
</div>
```

```js
/* hook: MUST be a separate capture-phase listener — the main keydown handler
   (index.html:6898) returns early for inputs and releases all ⌘ combos at :6922 */
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k'){
    e.preventDefault(); toggleCmdBar();
  }
}, true);
```

Ranking: simple subsequence + word-prefix scoring (~30 lines, no fuzzy-search dep).
↑/↓/Enter/Esc; ⌘K listed in the Help shortcut table (:1152) and surfaced by a one-time
`hintOnce` only after the user has seen the tour (it must never become a step Grandma
needs). Disabled while `ui.session`/`ui.tracking` own the keyboard, mirroring the
guards at :6901–6906.

---

## 4. Area 3 — Progressive disclosure (clutter layering)

### 4.1 High-cognitive-load surfaces (audit, ranked)

1. **Clip cards** (`renderClipList`, :4738–4756): up to **9 mini-buttons per card**
   (`▶ Play · 🎬 Save video · ➕ Reel · 🗒 · ⚖ · 🎤 · ✏️ Edit · ✂ Tighten · 🗑`).
   With 20 saved clips that is ~180 buttons in one scroll pane — the app's densest
   surface.
2. **Top bar** (:504–531): 14 buttons spanning four workflows (open, export,
   project-file management, season tools) at equal visual weight.
3. **Selected-drawing panel** (`#selSection`, :731–750): up to 8 buttons for a
   spotlight, mixing everyday acts (Appears/Disappears/Follow him) with rare ones
   (🩺 Save tracking report, ring sizing, ⏪ backwards-track).
4. Already-good models to copy, not fix: the transport "Advanced" `<details>` (:660),
   `#selSection` itself only appearing on selection, `selTrack`-style conditional
   buttons, Coach-tab accordions.

### 4.2 Two-tier plan

**Clip cards** — tier 1 keeps the daily verbs and the identity row; tier 2 folds
behind a chevron (native `<details>`, same pattern as `.adv`):

```
tier 1 (always):  ● title  0:41–0:58   ▶ Play · ➕ Reel · ✏️ Edit
                  [✂ Tighten to the action?]  ← stays tier-1 when proposed: it is
                                                 the app's one proactive suggestion
tier 2 (⌄ More):  🎬 Save video · ⚖ Compare · 🗒 Board · 🎤 Voice · 🗑 Delete
```

Attachment state must stay visible when folded (a 🎤✓/🗒✓ glyph row in the card head),
so nothing becomes *invisible*, only *unweighted*. The chevron state is per-card,
non-persisted (cards are re-rendered constantly); `tests/` that click `data-act`
buttons (`smoke.js`, `friction.js`, `voice.js`, `compare.js`, `board.js`, `autocut.js`)
get one shared helper `openMore(card)` added in `tests/common.js`.

**Top bar** — group without removing: keep `Open video… · 📁 Games · 📸 Photo ·
🎬 Save video · 🎬 Reel Studio · 📈 Progress · Aa · ❓ Help` at top level; fold
`💾 Save project / 📂 Load project / 📦 Keep this game` into one `📦 Project ⌄`
dropdown (they are weekly-or-rarer file-management acts; the hint text in each already
explains autosave covers the daily case). `🗒 Board / ⚖ Compare` fold into the new
per-clip pathways *plus* remain as a `More ⌄` group — their IDs (`#btnBoard`,
`#btnCompare`) are tour/test anchors and must keep existing.

**Selected-drawing panel** — tier 1: `Label · Visible-range · Appears here ·
Disappears here · 🎯 Follow him from here · 🗑 Delete`; tier 2 (`⌄ Fine-tune the
ring`): `📍 Pin him here · ⏪ Where he came from · 🔽/🔼 ring size · 🩺 Save tracking
report`. All conditional-display logic in `updateSelPanel()` (:2524) is preserved —
the fold wraps it, never replaces it.

### 4.3 Playhead-anchored utilities & boundary hovers

- **Playhead quick-mark cluster:** hovering the timeline shows a small floating chip
  pair above the cursor position — `⟦ Start here` / `End here ⟧` — that calls the
  existing `#btnMarkIn/#btnMarkOut` handlers at the *hovered* time (seek + mark on
  click). The transport buttons and I/O keys remain; this is the "slicing tools live
  on the playhead" ask, scoped to the two slicing verbs the app actually has.
- **In/Out boundary handles:** `#tlInOut` (:155) gets 6px-wide grab handles on its
  left/right edges (`cursor:ew-resize`, pointer-capture drag adjusting
  `ui.tIn/ui.tOut`) so a marked range can be *trimmed by direct manipulation* instead
  of re-seeking and re-pressing I/O. Zero-loss: I/O buttons and keys unchanged. On
  touch, handles get a 20px hit area (`pointer:coarse` rule).
- Not built: per-clip trim handles on `.tlClip` bars — saved-clip ranges are edited via
  ✏️ Edit (modal) and ✂ Tighten today; adding silent direct-manipulation of saved data
  from the timeline risks accidental edits from a missed seek-click. Revisit after
  Sprint 4 telemetry-by-use (the friction-backlog process PLAN.md already runs).

---

## 5. Capability checklist (retention verification)

Every current capability, and where it lives after the refresh. **Nothing is removed;
"folded" = still present behind one disclosure click; "＋" = gains an additional
pathway.**

| Capability (today) | After refresh |
|---|---|
| Open video (button, big button, drag-drop anywhere) | Unchanged ＋ smart-drop center zone |
| 📁 Games folder library | Unchanged, top-level |
| Play/pause, frame-step, ±5s, speeds (buttons + Space/K ←→ J/L [ ]) | Unchanged ＋ ⌘K |
| Timeline scrub-to-seek (mouse + touch) | Unchanged (micro-menu floats above, never intercepts) |
| Mark In/Out (buttons + I/O keys) | Unchanged ＋ playhead hover chips ＋ range boundary drag |
| Save clip (button + Enter, full modal: title/rating/position/format/tags/notes/question) | Unchanged |
| Clip: play-loop / export / reel / board / compare / voice / edit / tighten / delete | All kept — Play·Reel·Edit·Tighten tier 1; rest one chevron away ＋ micro-menu ＋ ⌘K |
| Reel: add, reorder ↑↓, clear, export one video, watch together | Unchanged ＋ drag-card-to-reel |
| All 6 draw tools (+ keys 1–6), colors, labels, arrow styles, zone shapes | Unchanged (PALETTE untouched) |
| Spotlight: keyframe drag, pin, follow, follow-backwards, ring size, track-all, report, Esc-cancel | All kept — everyday three tier 1, fine-tune tier 2 |
| Decision points (⏸ questions) | Unchanged |
| Board / Compare (full toolbars) | Unchanged internally; entry buttons grouped but same IDs |
| Export modes (Best for iPhone / Keeps sound), fps Advanced disclosure | Unchanged |
| Save/Load project, 📦 bundle | Kept, grouped under one `📦 Project ⌄` |
| Reel Studio (draft, drag-order, trims, reel/social/kit/data/plan-import) | Unchanged (gets Onyx tokens only) |
| Progress dashboard, CSV | Unchanged |
| ✨ Find his moments / ✂ Auto-cut proposals | Unchanged; Tighten *more* visible (tier 1 + micro-menu) |
| Sessions, voice-over, watch banner | Unchanged |
| Undo everywhere (⌘Z + toasts) | Unchanged — new pathways route through existing `mutate()` actions |
| Tooltips (hover + long-press), tour, hints, Aa comfort mode, big-text sizing | Unchanged; every new control ships `data-tip` + `body.bigText` rules |
| Keyboard map incl. Esc cascade | Unchanged ＋ ⌘K (previously released to browser) |
| Autosave, continuity, project JSON compatibility | Untouched (no data-model changes anywhere in this plan) |
| iPad/touch operation | All existing touch paths kept; hover-only additions explicitly degrade to today's paths |

---

## 6. Sprint roadmap

Sequential; each sprint is one commit-and-push with tests green, an updated PLAN.md
checkbox/decision-log entry (per CLAUDE.md), and README touch-ups where labels move.
`cd tests && npm install && ./make-fixtures.sh && npm test` before every push.

**Sprint 1 — Onyx foundation (CSS only; ~1 session).**
Token swap at :15–20 + the §2.3 hardcoded-color sweep + monochrome demotions +
dimensional borders/shadows (§2.4 panes/cards). No markup or JS changes.
*Gate:* `comfort.js` AA suite green in both text sizes; screenshot walk
(`plainwords.js` does one) eyeballed; `smoke.js` green. *Risk:* low — token-driven.

**Sprint 2 — Tangible timeline (CSS + ~40 lines JS).**
`.tlClip` block treatment, accent playhead, `#tlInOut` boundary-drag handles,
playhead hover quick-mark chips. Touch hit-areas + reduced-motion entries.
*Gate:* `touch.js`, `smoke.js` (mark-in/out flows) green; new assertions for
boundary-drag in `friction.js` style. *Risk:* pointer-capture interplay with
scrub-seek — handles must `stopPropagation` on their own pointerdown only.

**Sprint 3 — Command bar (~150 lines).**
`clipAction()` dispatcher refactor (pure extraction, no behavior change) → registry →
`#cmdModal` palette + capture-phase ⌘K hook + Help table row + `hintOnce`.
*Gate:* new `tests/cmdbar.js` (open, type, run, guards during session/tracking, Esc);
`tips.js` (new controls have sentences); `plainwords.js` sweep. *Risk:* low.

**Sprint 4 — Contextual micro-menu (~120 lines).**
`#microMenu` on `.tlClip` hover, driven by the Sprint-3 dispatcher; contextual
entries (Tighten-when-proposed, ✓ states). Desktop-hover only, documented touch
degradation. *Gate:* new `tests/micromenu.js`; regression: timeline seek untouched
(`smoke.js`). *Risk:* hover-intent flicker — 150ms enter delay, shared hide timer.

**Sprint 5 — Smart-drop zones + drag-to-reel (~180 lines).**
`#dropZones` overlay routing to `loadVideo`/Compare-file/project-load with today's
handler as universal fallback; `.clipItem` drag-to-reel via storyboard drag pattern.
*Gate:* extend `smoke.js` drop tests + new zone tests; failure-toast texts asserted
unchanged. *Risk:* browser dragevent quirks on `file://` — test in real Chrome +
Safari manually (Playwright Chromium can't cover Safari; note in PR).

**Sprint 6 — Progressive disclosure (~1 session).**
Clip-card two-tier + head status glyphs; top-bar `📦 Project ⌄` group; `#selSection`
fine-tune fold; `tests/common.js` `openMore()` helper + suite updates
(`smoke/friction/voice/compare/board/autocut`). Tour anchor IDs re-verified
(`tour.js`, `walkthrough.js`). *Gate:* full suite green; `tips.js` full-control audit
(it reaches folded controls — chevrons must be openable by the test's walker).
*Risk:* highest test-churn sprint — do it last, when the new-component patterns are
settled.

**Stretch S-A (needs explicit sign-off, not scheduled):** audio-energy strip under the
timeline (§2.4 caveat — memory spike on long games must be measured on iPad first).

Proposed PLAN.md decision-log entries are drafted per-sprint in the executor's commits;
suggested epic name for PLAN.md: **v7 — "Onyx" (the same tool, quieter and closer)**.

---

## 7. Files requiring modification (summary for the executor)

| File | Sprints | Nature |
|---|---|---|
| `index.html` `<style>` (14–499) | 1, 2, 4, 5, 6 | tokens, sweep, new component CSS |
| `index.html` markup (504–531, 628–668, 731–756, 1207~) | 2, 3, 4, 5, 6 | new overlay elements, top-bar grouping |
| `index.html` script (1378, 1997, 2008, 4719, 6898, 8600s) | 2–6 | dispatcher refactor, hooks, new components |
| `PLAN.md` | every sprint | checkboxes + decision log (CLAUDE.md requirement) |
| `README.md` | 3, 6 | ⌘K, regrouped top bar |
| `tests/common.js`, `tests/smoke.js`, `tests/friction.js`, `tests/touch.js`, suite of per-feature tests | 2–6 | helpers + updated selectors |
| `tests/cmdbar.js`, `tests/micromenu.js`, `tests/dropzones.js` | 3, 4, 5 | new suites |
| **Never touched:** `lockon.js`, `sw.js`, `manifest.webmanifest`, `drawScene()`/export/tracking code paths, project JSON schema, `PALETTE` | — | — |
