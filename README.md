# ⚽ Film Room — game footage splicer & study tool

A film-study tool for breaking down youth soccer footage with your player — built for
showing them what actually happened on the field vs. what they *think* happened, without
the session ever feeling like a lecture.

Everything runs **locally in your browser from a single file**. No installs, no accounts,
no uploads — your footage never leaves your machine.

## Getting started (10 seconds)

1. Download or clone this repo.
2. Double-click **`index.html`** (or drag it into Chrome/Safari).
3. Drag a game video onto the window.

That's it. Bookmark the page and it's a daily tool.

> Tip: `index.html` is fully self-contained — you can copy it anywhere (Desktop, iCloud
> Drive, a second Mac) and it just works.

## Getting your footage in

- **iPhone videos (Apple Photos):** AirDrop the clip to your Mac, or in Photos use
  *File → Export → Export Unmodified Original*. Open the `.mov`/`.mp4` in Film Room.
- **YouTube videos shared with you:** press **⌘⇧5** on your Mac, screen-record the
  section you care about, then open that recording in Film Room. You can trim it first in
  QuickTime (*Edit → Trim*) if you want a smaller file.
- Once a video is open, everything you do (clips, drawings, decision points) **autosaves
  in the browser** and comes right back the next time you open the *same file*
  (matched by name + size). Use **💾 Save project** for a portable backup file.

## What it does

### 🎥 Study controls
- Slow motion (¼×, ½×, ¾×), **frame-by-frame stepping** (set fps to 30 or 60 to match
  iPhone footage), 5-second jumps, click-to-scrub timeline.

### ✏️ Telestration (drawing on the video)
- **🔦 Spotlight** — a colored ring + name that **follows a player**. Drop it on your
  son, scrub ahead, drag it to where he is now; it glides between keyframes. Add a second
  spotlight in another color for the defender or the open teammate.
- **➡️ Arrows** with meanings: **pass** (solid), **run** (dashed), **dribble** (wavy),
  **shot** (heavy) — show where the ball *should* have gone, the run he should make,
  the lane to attack.
- **▨ Zones** — shade the space to take, the space to move into to drag a defender,
  or the area he's responsible for defensively.
- **✍️ Pen & 🔤 text** — circle the back line's shape, note the coaching point right
  on the frame.
- Every drawing has a visible time window, so annotations appear and disappear as the
  play unfolds.

### 🧠 Decision points (the self-awareness tool)
Add a **decision point** just before a key moment. On playback the video freezes and
shows a question — *"What are the options here? What would you do?"* — so he answers
**before** seeing what actually happened. Then hit play and compare his answer with
reality. This is the heart of building game IQ from film.

### 🎬 Clip library
Mark **In/Out** around any moment and save it as a tagged clip:
- Rated **👍 Strength / 🔧 Work-on / 💡 Teachable** — so sessions stay balanced and
  positive.
- Tagged from a soccer-IQ taxonomy: high-IQ play, heavy touch, good/bad risk, missed
  1v1, line-breaking pass, found/created space, should-have-moved, goal-side, pressing
  angle, low effort, scanning, transition moments, and more.
- Tagged by **position** (attacking mid, winger, …) and **format** (5v5/7v7/9v9/11v11).
- Clips **loop** when played — perfect for "watch it once more; now what do you see?"
- Filter the library by rating or tag to build a themed session ("tonight: off-ball
  movement work-ons").

### 📤 Sharing it back to him
- **🎬 Export clip** — renders any clip (or the In→Out range) **with all drawings burned
  in** to a video file you can AirDrop to his phone/iPad.
- **📸 Still** — saves the current annotated frame as an image; the fastest way to send
  one teaching picture.

### 🧑‍🏫 Coach tab
Built-in cheat sheets for **attacking mid** and **winger** in 9v9 (scanning, receiving
half-turned, playing between lines, 1v1 green lights, tracking runners, goal-side
recovery…), general defensive principles, format notes from 5v5 to 11v11 — and a list of
**questions to ask him instead of telling him**, ending every session with
*2 things he did well, 1 thing to work on — in his own words*.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` `→` | Step one frame (`Shift` = 1 second) |
| `J` / `L` | Back / forward 5s |
| `I` / `O` | Mark clip In / Out |
| `Enter` | Save clip from In→Out |
| `1`–`6` | Tools: Select · Spotlight · Arrow · Zone · Pen · Text |
| `[` / `]` | Slower / faster |
| `Delete` | Delete selected drawing |
| `⌘Z` | Undo |
| `?` | Help |

## A suggested daily routine

1. After a game, AirDrop the footage over and skim at 1× with a finger on `I`/`O`.
2. Save 4–6 clips: **at least 2 strengths**, 2 work-ons, 1–2 teachable moments.
3. On the work-ons, add a **decision point** and draw the *better* option (arrow + zone).
4. Watch together — him talking, you asking the Coach-tab questions.
5. Export 1–2 clips to his phone as the week's visual reminder.

## Notes & limits

- Exports use your browser's recorder: Chrome typically produces `.webm`, Safari `.mp4`.
  If a `.webm` won't AirDrop-play on an iPhone, run the export in Safari, or drop the
  file into QuickTime/HandBrake to convert.
- Export plays the clip through once in real time while recording (a 20s clip takes 20s).
- Autosave is per-browser. Moving to another machine? **💾 Save project** and keep the
  `.filmroom.json` next to the video file.
