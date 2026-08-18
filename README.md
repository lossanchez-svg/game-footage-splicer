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

## Using it on an iPad (or phone)

The whole editor works by touch — tap tools, tap to spotlight, drag arrows and zones,
tap the timeline to scrub. On narrow screens the panel moves below the video.

To make it a real home-screen app on the iPad:
1. **One-time:** on GitHub, open this repo's *Settings → Pages* and enable Pages from
   the main branch. That gives the app a private-enough URL (the page is just the app —
   your footage still never leaves the device; videos load from the iPad's Files/Photos).
2. On the iPad, open that URL in Safari → Share → **Add to Home Screen**.
3. It now launches full-screen like an app and works offline. Open game video straight
   from Files or Photos with the **Open video…** button.

## Getting your footage in

- **iPhone videos (Apple Photos):** AirDrop the clip to your Mac, or in Photos use
  *File → Export → Export Unmodified Original*. Open the `.mov`/`.mp4` in Film Room.
- **YouTube videos shared with you:** press **⌘⇧5** on your Mac, screen-record the
  section you care about, then open that recording in Film Room. You can trim it first in
  QuickTime (*Edit → Trim*) if you want a smaller file.
- **Trace / Veo camera film:** if whoever shares it has portal access, downloading the
  game video as a file from the Trace/Veo site beats screen-recording YouTube — much
  better quality, especially for zoomed-out footage. Worth asking for.
- Once a video is open, everything you do (clips, drawings, decision points) **autosaves
  in the browser** and comes right back the next time you open the *same file*
  (matched by name + size). Use **💾 Save project** for a portable backup file.

## What it does

### 🎥 Study controls
- Slow motion (¼×, ½×, ¾×), **frame-by-frame stepping** (set fps to 30 or 60 to match
  iPhone footage), 5-second jumps, click-to-scrub timeline.

### ✏️ Telestration (drawing on the video)
- **🔦 Spotlight** — a colored ring + name that **follows a player**. Drop it on your
  son, set where the play ends (*End = playhead*), and hit **🎯 Auto-track** — it follows
  him automatically, no keyframing needed (and tells you where to re-anchor if it loses
  him in a crowd). You can also track by hand: scrub ahead and drag the ring; it glides
  between keyframes, and auto-tracked paths stay hand-editable the same way. Add a
  second spotlight in another color for the defender or the open teammate. On zoomed-out
  sideline or Trace-camera footage, use **Ring −/＋** to fit the ring to the player —
  that also right-sizes what the tracker looks for.
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
  angle, low effort, scanning, transition moments, and more — and the whole tag list is
  **editable** (✎ Edit tag list in the save dialog) so it can match the exact words his
  coach uses.
- Tagged by **position** (attacking mid, winger, …) and **format** (5v5/7v7/9v9/11v11).
- Clips **loop** when played — perfect for "watch it once more; now what do you see?"
- Filter the library by rating or tag to build a themed session ("tonight: off-ball
  movement work-ons").

### 📤 Sharing it back to him — clips that teach on their own
Exports are built so the clip works **without you in the room** (his mom can play it,
or he can watch solo on a phone, iPad, or the TV):
- **🎬 Export clip** — renders a clip with all drawings burned in, at up to 1080p with
  TV-grade bitrate (holds up on an 80″ screen). Each clip export opens with a **title
  card** (rating, position, your coaching note), and any decision point inside becomes a
  **built-in freeze-frame showing the question** before the play continues — the
  "what should happen here?" moment is part of the video itself.
- **Two export modes** (picker appears in the top bar where supported):
  **⚡ mp4 · silent** builds a true H.264 `.mp4` frame-by-frame — plays natively on any
  iPhone/iPad/TV with no conversion, never drops frames, works from any browser.
  **🔊 with audio** records in real time and keeps the game sound (file format depends
  on the browser — Safari gives mp4, Chrome may give webm).
- AirDrop the file to a phone/iPad, then **AirPlay to the TV** for the big-screen review.
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

- **⚡ mp4 exports are silent** (game audio isn't included yet — it's on the roadmap).
  When the crowd noise matters, use **🔊 with audio**, which records in real time
  (a 20s clip takes 20s) and whose format depends on the browser.
- Autosave is per-browser. Moving to another machine? **💾 Save project** and keep the
  `.filmroom.json` next to the video file.
