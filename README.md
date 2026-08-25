# ⚽ Film Room — game footage splicer & study tool

A film-study tool for breaking down youth soccer footage with your player — built for
showing them what actually happened on the field vs. what they *think* happened, without
the session ever feeling like a lecture.

Everything runs **locally in your browser from a single file**. No installs, no accounts,
no uploads — your footage never leaves your machine.

## Getting started (10 seconds)

1. Download or clone this repo.
2. Double-click **`index.html`** (or drag it into Chrome/Safari).
3. Press **Open a video…** and pick a game.

That's it. The first time you open it, a short walkthrough points at each control in
turn and moves on as soon as you actually do the thing — open a video, press play,
spotlight a player, save a moment. Skip it any time; restart it later from **❓ Help**.
Bookmark the page and it's a daily tool.

> Tip: `index.html` is fully self-contained — you can copy it anywhere (Desktop, iCloud
> Drive, a second Mac) and it just works. If you copy it somewhere, bring `lockon.js`
> along too when you can: it holds the on-device player spotter that smart tracking
> uses. Everything still works without it (the classic tracker takes over), and nothing
> about your footage ever leaves your computer either way.

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

The best path depends on the device — each one leads with its strongest option:

- **iPhone / iPad:** tap **Open from Photos** — that's Apple's own Photos picker,
  with your albums right there. Native, one tap, done.
- **Mac — the 📁 Games library:** keep game films in one folder and point **📁 Games**
  at it once (Chrome/Edge; the button hides in browsers that can't do this). From then
  on every game is one click away, newest first, with a 📝 marker on games that already
  have clips and drawings. Getting films *into* the folder is one drag from the Photos
  app to that folder in Finder — that drag works (it's only dragging into a browser
  window that macOS Photos can't do). **Make it an iCloud Drive folder** and the same
  films appear on your Mac, iPhone, and iPad automatically.
- Mac fallbacks: drag files in from Finder/Desktop, or **Open video…** (the picker's
  sidebar has *Media → Photos* on some setups, though it can be unreliable about
  albums — the Games folder is the dependable path).
- **YouTube videos shared with you:** press **⌘⇧5** on your Mac, screen-record the
  section you care about, then open that recording in Film Room. You can trim it first in
  QuickTime (*Edit → Trim*) if you want a smaller file.
- **Trace / Veo camera film:** if whoever shares it has portal access, downloading the
  game video as a file from the Trace/Veo site beats screen-recording YouTube — much
  better quality, especially for zoomed-out footage. Worth asking for.
- **Working on more than one computer?** Open a game from **📁 Games** and Film Room
  saves your clips and drawings into that folder too, next to the video
  (`<video>.filmroom.json`). Keep the folder in iCloud Drive and the same game opened on
  another Mac picks up your work automatically — no Save/Load step. You'll see
  **☁︎ Saving to your Games folder** in the top bar when it's on, and the game list marks
  films that already have work, including work done somewhere else. If both computers
  have been used, whichever was saved most recently wins and the app tells you which one
  it opened. Nothing is uploaded: it's your folder, syncing the way it already did.
- Once a video is open, everything you do (clips, drawings, questions) **autosaves
  in the browser** and comes right back the next time you open the *same file*
  (matched by name + size). Use **💾 Save project** for a portable backup file.

## What it does

### 🎥 Study controls
- Slow motion (¼×, ½×, ¾×), **frame-by-frame stepping**, 5-second jumps, and a
  drag-anywhere timeline. Hover or long-press any control and a plain-English bubble
  says what it does and when you'd use it.
- Frame stepping assumes 30 pictures a second. iPhone video is often 60 — that setting
  lives under **Advanced** in the transport bar, and nothing else needs it.

### ✏️ Telestration (drawing on the video)
- **🔦 Spotlight** — a colored ring + name that **follows a player**. Drop it on your
  son and hit **🎯 Auto-track** — it follows him from wherever you are until it loses him,
  with nothing to set up first and nothing to place by hand. Since v4 it tracks by
  actually *seeing the players*: a small on-device spotter (the `lockon.js` file next to
  `index.html`) finds everyone in the frame and the ring stays with *him* — through
  teammates in the same kit crossing him, through him disappearing behind someone, and
  through the camera swinging. If he runs out of the picture it says so straight away,
  and when it does lose him you just tap him where you can see him and it carries on.
  Nothing changes about privacy: the spotter runs entirely on your computer, and if the
  file is missing the classic tracker takes over on its own. Want it to stop at a particular
  moment? Set *Disappears here* first and it respects that. Two players to follow — him
  and the defender? Put a ring on each and press **🎯 Follow everyone on screen**: they
  are tracked in a single pass, which is barely slower than doing one. And when the moment
  you can find is the moment the ball *arrives*, put the ring on him there and press
  **⏪ Where he came from** — it works backwards and fills in the run that got him there,
  which is usually the thing actually worth talking about. You can also do it by hand: move ahead and drag the
  ring, or press **📍 Pin him here**; the ring glides between the spots you set, and an
  auto-tracked path stays just as editable. Add a
  second spotlight in another color for the defender or the open teammate. The tracker
  is built for **zoomed-out and fuzzy footage** (far sideline iPhone, Trace cameras,
  screen-recorded YouTube): it's immune to auto-exposure/brightness drift, predicts
  where the player is heading through camera pans, and **coasts through brief
  crossings** — when another player runs across him, it keeps moving on his predicted
  path and re-locks on the other side. On far footage it measures how big he actually is
  and **pulls the ring in to fit him by itself** — no setting to find. If you want to
  adjust it, select the spotlight and use **🔽 Smaller ring** / **🔼 Bigger ring**.
  If it still leaves the player on your footage, hit **🩺 Save tracking report** on the
  spotlight panel right after a run and send the JSON file — it records what the tracker
  saw (match scores, patch sizes, positions) so the failure can be read as numbers. It
  contains no video and no frames.
  The tracker holds itself to a bar measured from your own footage — if the grass
  around him can impersonate him, the bar goes up to match — and it will tell you it
  lost him rather than follow the field and claim a clean run.
  It also matches **his shape rather than a square of ground**: when you drop the ring
  it measures how much of the picture he actually fills and cuts the template to that,
  which is what keeps it on your son rather than on the team-mate in the identical kit
  running the other way.
  **Auto-track runs until it loses him, whatever you have marked.** Clip start/end marks
  do not cut it short. The only thing that stops it early is an end you set on that
  spotlight with **Disappears here** — and if that happens, it tells you so.
  **It does not rely on one view of him.** Several templates cut differently from your
  son — his measured outline, a tight crop, a wider one taking in his surroundings — track
  him at once, and the ring goes where they agree. Each has to prove it can find him
  before the run starts, one that fails costs a vote instead of the whole clip, and when
  they disagree the one that continues his motion wins — because with both teams in the
  same kit, how he is moving is the only thing that tells him from a team-mate. If it was
  unsure of him for a stretch, it says so at the end instead of pretending.
  A spotlight stays on screen for the length of a play, not a few seconds, and dragging
  or pinning him anywhere stretches it to cover that moment — so following him by hand
  works even where the tracker gives up.
  If it does lose him — he goes behind someone, or turns away — it **looks for him again**
  rather than stopping, and picks him back up when it is sure. It only counts that as
  finding him if the picture of him from the very first frame agrees, twice.
- **➡️ Arrows** with meanings: **pass** (solid), **run** (dashed), **dribble** (wavy),
  **shot** (heavy) — show where the ball *should* have gone, the run he should make,
  the lane to attack.
- **▨ Zones** — shade the space to take, the space to move into to drag a defender,
  or the area he's responsible for defensively.
- **✍️ Pen & 🔤 text** — circle the back line's shape, note the coaching point right
  on the frame.
- Every drawing has a visible time window, so annotations appear and disappear as the
  play unfolds.

### ⚖ Side-by-side — his touch vs. the model touch
Hit **⚖** on any clip to play it in lockstep next to a "model" — another clip from the
library, or an outside video file (a screen-recorded pro example works great). Both
sides frame-step and slow-mo together, the pair loops automatically, and an **align**
nudge lines the key moments up. **📸 Photo** grabs a labeled two-pane image. Nothing
teaches "this is what it should look like" faster.

### 🗒 Tactics board — teach the scheme off-video
Hit **Board** in the top bar for a top-down pitch with both teams lined up in formation
(5v5/7v7/9v9/11v11 presets). Drag player chips around, double-click to name them, and
use the same arrow/zone/pen/text tools to draw the rotation, the press, the run he
should make. Keep several named boards per game, attach one to any clip with the clip's
**🗒** button ("here's the shape behind that moment"), and export any board as a PNG to
text to him. A clip with a board attached **shows it as a card in the video** — right
after the clip, so the idea lands while the moment is still fresh, and after he has had
his own go at the answer. **⟲ Line up** resets the players without losing your drawings.

### 🧠 Questions mid-clip (the self-awareness tool)
Add a **question** just before a key moment. On playback the video freezes and
shows a question — *"What are the options here? What would you do?"* — so he answers
**before** seeing what actually happened. Then hit play and compare his answer with
reality. This is the heart of building game IQ from film.

### 🎬 Clip library
Press **Start clip here** and **End clip here** around any moment, then **＋ Save clip**
to keep it with tags:
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

### 🎞 Highlight reels — the weekly TV package
Tick clips into a reel with **➕ Reel**, order them with ↑↓ (strengths first, end on a
high note), give it a title, and **🎬 Save as one video** produces **one file**: an opening
title card, then every clip with its own coaching card, decision-point freezes, and the
game audio. AirDrop it once, AirPlay to the TV, and the whole week's review runs itself.

### 🎬 Reel Studio — the recruiting reel, planned from the whole season
**🎬 Reel Studio** in the top bar works across every game you have broken down — no
video needs to be open. It lines up every strength and teachable moment of the season
(work-ons stay out), and **✨ Draft it for me** proposes a starting order you then make
yours: drag plays up and down, trim each one tighter half a second at a time, switch
the spotlight ring or the "watch him first" freeze on or off per play, and reword the
context line (which game, when) that gets printed under it. A quiet line of coaching
keeps you honest — best play first, three to five minutes, end on a high — and if his
player card names a position, a small checklist shows what a coach looks for and ticks
what the plan already covers. The plan saves itself as you go and rides along in your
Games folder.

Then two buttons make the files, reading the footage straight from your Games folder
(nothing is ever uploaded):

- **🎬 Make the reel** — one full-1080p video for coaches: his opening card (name,
  photo, number, grad year, height, GPA, contact), then every play — a short
  "Watch #81" freeze so the coach finds him instantly, the game and date burned in
  small, his spotlight ring if you left it on — and a contact card at the end. Game
  sound and any voice-overs come along. The file is named the way a coach files it.
- **📱 Make the social cut** — the same plays as a tall phone-shaped video for
  Instagram, TikTok or Shorts. The picture follows him automatically (that is what
  the tracker is for), your reel title opens as a hook, each play is captioned, and
  his handle sits in the corner. Keep it under a minute — that is what gets watched.

If a play's game video is missing from the folder, the studio names it and only makes
the reel without it when you press the button a second time — never silently. Long
renders say about how many minutes are left.

### 🎽 His player card — fill it in once
In the Clips tab, **✎ Fill in his card** takes his name, number, grad year, positions,
club, height, GPA, a photo, and how a coach reaches you. From then on every reel's
opening card leads with *him* — name, photo, roster line — and saved videos are named
the way a coach would file them (*Jude Sanchez - 2032 - Attacking Mid - Week 3.mp4*).
It rides along in your Games folder, so a card filled in on the Mac shows up on the
iPad. Everything except his name is optional; edit it any time.

### ▶ The front door — "this week's film session is ready"
Open a game that already has clips lined up and a banner sits across the top of the
screen: *"This week's film session is ready"*, with the reel title, how many clips and
roughly how long it takes, and one button — **Start watching**. That's the whole
interface for whoever is watching rather than editing. **Not right now** hides it for
this visit; it's waiting again next time the game is opened. The session screens
themselves are set in large type with thumb-sized buttons, so they read from the sofa.

### 🎓 Guided sessions — anyone can run film night
**🎓 Watch together** plays the same reel list as an interactive Q&A right in the app: each
clip shows its question **first** ("Where is the space?" — set per clip, or use the
default), he answers out loud (type it in his words if you want it kept), then the clip
plays, decision-point pauses and all, with *watch again* one tap away. It ends with the
recap that keeps sessions positive: **two things he did well + one thing to work on —
his words**. Every session lands in the **📓 session log** with a downloadable notes
file, so you can see his answers even when his mom ran the session or he did it solo —
and watch his game-reading sharpen week over week.

### 📤 Sharing it back to him — clips that teach on their own
Exports are built so the clip works **without you in the room** (his mom can play it,
or he can watch solo on a phone, iPad, or the TV):
- **🎬 Save video** — renders a clip with all drawings burned in, at up to 1080p with
  TV-grade bitrate (holds up on an 80″ screen). Each clip export opens with a **title
  card** (rating, position, your coaching note), and any decision point inside becomes a
  **built-in freeze-frame showing the question** before the play continues — the
  "what should happen here?" moment is part of the video itself.
- **Two ways to make the file** (the picker in the top bar names them in plain words):
  **Best for iPhone** builds a true H.264 `.mp4` frame-by-frame — plays natively on any
  iPhone/iPad/TV with no conversion, never drops frames, and **carries the game audio
  over** from iPhone/`.mov` footage (silence under the title card and decision freezes,
  exactly where it belongs). **🔊 real-time** records the playthrough instead (file
  format depends on the browser — Safari gives mp4, Chrome may give webm). It appears in
  the picker as **Keeps sound, slower**.
- AirDrop the file to a phone/iPad, then **AirPlay to the TV** for the big-screen review.
- **🎤 Voice-over** — press 🎤 on any clip and talk over it while it plays. Your voice
  goes into the exported video with the game sound turned down underneath, so the clip
  coaches on its own when he watches it alone or his mum plays it. If you added a
  question to the clip, the narration goes quiet at the freeze exactly like the picture
  does, then carries on. Recordings stay on the computer you made them on (they're kept
  outside the project file so they can't fill up the browser's storage), and they need
  the **Best for iPhone** way of saving — the app says so if you pick the other one.
- **📸 Photo** — saves the current annotated frame as an image; the fastest way to send
  one teaching picture.

### 📈 Progress — the season, not just the game
**📈 Progress** in the top bar reads every game you've broken down (including work done
on another computer, via the Games folder) and shows how he's doing across the season:
how many games and moments, what share are strengths, a bar for every game in date order,
the labels that come up most — and, once there are four games, **what is changing**:
*"Heavy / poor touch — coming up less often: about 2 a game early on, 0 a game lately."*

It ends with **his own words**: when the same question comes round in a later session,
both answers sit side by side in date order —

> *Mar 2* — "i dunno i just passed it"
> *Mar 22* — "i looked over my shoulder first so i knew the 9 was open"

That comparison is the clearest picture you can get of his game-reading changing, and it
is why the session builder asks before it shows him the film. Underneath it, the one
thing you said to work on at the end of each session, newest first — repeats are the
point.

That last part is the bit no highlight service can tell you, because it comes from the
things **you** chose to name. Filter by position or format, and **⬇ Spreadsheet** exports
every saved moment as a CSV for Numbers, Excel or Sheets.

### 🧑‍🏫 Coach tab
Built-in cheat sheets for **attacking mid** and **winger** in 9v9 (scanning, receiving
half-turned, playing between lines, 1v1 green lights, tracking runners, goal-side
recovery…), general defensive principles, format notes from 5v5 to 11v11 — and a list of
**questions to ask him instead of telling him**, ending every session with
*2 things he did well, 1 thing to work on — in his own words*.

### 👀 Comfort mode
The **Aa** button in the top bar makes everything bigger — text, buttons, tabs,
tooltips, the lot — and remembers your choice. Messages also stay on screen longer so
there's time to read them. The dark theme meets WCAG AA contrast throughout, and every
control shows a clear focus ring when you move through the app with the keyboard.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` / `K` | Play / pause |
| `←` `→` | Step one frame (`Shift` = 1 second) |
| `J` / `L` | Back / forward 5s |
| `I` / `O` | Start clip here / End clip here |
| `Enter` | Save the marked moment as a clip |
| `1`–`6` | Tools: Select · Spotlight · Arrow · Zone · Pen · Text |
| `[` / `]` | Slower / faster |
| `Delete` | Delete selected drawing |
| `⌘Z` | Undo |
| `?` | Help |

## A suggested daily routine

1. After a game, AirDrop the footage over and skim at 1× with a finger on `I`/`O`
   (**Start clip here** / **End clip here**).
2. Save 4–6 clips: **at least 2 strengths**, 2 work-ons, 1–2 teachable moments.
3. On the work-ons, add a **question** and draw the *better* option (arrow + zone).
4. Watch together — him talking, you asking the Coach-tab questions.
5. Export 1–2 clips to his phone as the week's visual reminder.

## 📦 Keeping a season

**📦 Keep this game** packs everything from a game into one zip you can archive next to
the film: the project file, a spreadsheet of every moment, his answers from each session,
the tactics boards as pictures, and your voice-overs — those live only in the browser you
recorded them in, so this is the only way to keep them or move them to another computer.
Tick the box and it adds a video of every moment too (slower, and much bigger — it tells
you roughly how long).

Inside there's a `README.txt` explaining what each folder is and how to get the work back,
so the bundle still makes sense to whoever opens it years later. The game video itself is
deliberately left out — you already have it, and it's the big part.

## Mistakes are cheap

Nothing asks *"are you sure?"* where the answer can simply be taken back. Delete a clip,
a drawing, a board, a session or this week's list and it just happens — the message that
says so carries an **↩ Undo** button that restores exactly that deletion, even if you
changed something else in between. `⌘Z` still walks back through everything.

And nothing fails silently: press play (or any other control) before a game is open and
the app says what is missing and points at the button that fixes it.

## Notes & limits

- **⚡ mp4 export audio** comes straight from the source file's AAC track — iPhone
  videos and ⌘⇧5 screen recordings both have one. A WebM source, or a browser that
  can't encode AAC, exports silent (the app tells you when that happens); the
  **Keeps sound, slower** mode always keeps audio but records in real time (a 20s clip
  takes 20s) and its format depends on the browser.
- Autosave is per-browser. Moving to another machine? **💾 Save project** and keep the
  `.filmroom.json` next to the video file.
