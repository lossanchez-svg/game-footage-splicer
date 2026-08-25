# Autopilot — the full-automation option (OFF unless you run it)

This is a **recipe a Claude Code session follows on your own machine**, not a
switch inside the app. Film Room itself never talks to a network, never posts
anywhere, and works exactly the same whether or not you ever use this file.
Autopilot exists for one job: carry a new game all the way to a **draft**
reel while you sleep — always a draft for you to review, never a decision
made behind your back.

## The hard rules (every run, every tier)

1. **Draft-only.** The output is a reel plan loaded into the app's Reel
   Studio as a draft, plus (if you asked for it) a draft mp4 file on your
   disk. Autopilot never exports on its own authority, never posts anywhere,
   never emails anyone, and never touches your original footage.
2. **Choosing the moment is the coaching.** The finder recalls, the plan
   proposes — you dispose. Every accepted draft is *your* accepted draft.
3. **Privacy tiers escalate only by your explicit choice, per run:**
   - **E0 — metadata only (the default).** The model reads
     `filmroom-metadata.json`: words and numbers, never pixels. The file is
     built by the app to contain no image data at all.
   - **E1 — stills on approval (per-run opt-in).** You may choose to show
     the model selected still frames of candidate moments for judgment calls
     (which play leads, is the framing clean). Stills only, never video, and
     the run must list exactly which frames were shown.
   - **E2 — fully local (future).** The judgment calls move to an on-device
     model once one meets the same vendorable bar `lockon.js` did (licence,
     size, offline). Not available yet; do not simulate it.
4. **The report card is measured, not argued.** Every imported draft is
   fingerprinted by the app; the next season-data export carries
   `reelPlan.editsSinceImport` — how many human corrections the draft took
   (removals, additions, reorders, re-trims, a retitle). Report the previous
   draft's number at the start of each run. Zero corrections, sustained
   across runs with clean spot-checks, is what "fully capable" means here.

## What a run looks like (E0)

You need: the app (`index.html`), your Games folder, and a Claude Code
session started in this repository.

1. **Give it the season.** In the app: 🎬 Reel Studio → **📋 Save the season
   as data** → hand the Claude session the `…season data.json` file (and say
   which game is new). If a previous run's draft was reviewed, the session
   reports its `editsSinceImport` first — the ledger.
2. **Scan the new game** (recall, not judgment). Easiest: open the game in
   the app, ring on him, **✨ Find his moments**, accept/reject as you like,
   and re-export the season data. Fully hands-off alternative: the session
   drives the scan headlessly the way `tests/` drives the app, then treats
   every candidate as unreviewed (and says so in the review sheet).
3. **Judgment.** The session picks and orders a reel from the metadata —
   coach's eye and marketing sense, with the same rules the studio teaches:
   the single best play first, 3–5 minutes, strengths only, end on a high;
   context labels a scout can read; title and hook that say who he is. It
   writes `filmroom-reelplan.json` (`format: "filmroom-reelplan"`,
   `version: 1`, `title`, `items: [{game, clipId, trimIn, trimOut,
   spotlight, freezeIntro, label}]`).
4. **The review sheet** (always, same file next to the plan,
   `review-sheet.md`): three short sections in plain words —
   **Chosen** (each play and why it earns its slot), **Passed on** (what was
   left out and why), **Not sure** (anything the session could not judge
   from words alone — the E1 candidates, if you ever opt in). No jargon;
   write it for the parent, not for a log file.
5. **Back into your hands.** In the app: 🎬 Reel Studio → **📥 Load a reel
   plan** → review the draft, drag what's wrong, then press **🎬 Make the
   reel** yourself. That is the default ending. If you explicitly asked for
   a hands-off render, the session may run the headless renderer —
   `node tests/autopilot/render.js <video> <project.json> <plan.json> <outDir>`
   (real Chrome via `CHROME_PATH` for H.264; one game per run — multi-game
   plans render through the app's own button) — and the resulting mp4 is
   still a **draft file on your disk**, nothing more.

## What Autopilot may NOT do

- Post, upload, email, or share anything, anywhere, ever.
- Read, copy, or send footage, stills (below E1), or the player photo.
- Render and then delete/replace an existing reel — drafts get new names.
- Mark its own homework: the edit-distance number comes from the app's
  export, not from the session's memory.

## For the Claude session following this recipe

Read `PLAN.md` (the v6 epic section and the decision log) before the first
run. The socket formats are versioned — if `version` in a file is newer than
what this document describes, stop and say so. When in doubt between doing
something clever and doing something the parent will understand, do the
thing the parent will understand.
