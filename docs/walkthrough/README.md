# Fresh-eyes walkthrough

Screenshots of the whole first-time journey through Film Room, in order. They are
generated, not hand-taken — regenerate them any time with:

```sh
cd tests && node walkthrough.js     # writes tests/out/walk_*.png  (01-13)
cd tests && node trends.js          # writes tests/out/trends_dashboard.png  (14)
cd tests && node insights.js        # writes tests/out/insights.png  (15 is a crop of it)
```

The images here are those files, colour-quantised to keep the repo light. They exist so
the onboarding can be reviewed without running anything, and so a future change that
quietly breaks a step is visible.

| # | Screen | What it shows |
| --- | --- | --- |
| 01 | Cold open | The walkthrough's first step, pointing at the one button that matters |
| 02 | Video open | Step 2 arrives on its own, because a video loaded |
| 03 | Playing | Pressing play advances the walkthrough |
| 04 | Spotlight | A named ring on the player; the walkthrough moves to keeping the moment |
| 05 | Marked | "Start clip here" / "End clip here" marked on the timeline |
| 06 | Save clip | Naming it, rating it, the coaching note, the question to ask him |
| 07 | Clips tab | His library — and the walkthrough finishing |
| 08 | Tooltip | What hunting for a control looks like now |
| 09 | Watch banner | The front door: this week's session, ready, one button |
| 10 | Session intro | What the family sees when they press it |
| 11 | Session question | The question, before the clip, in XL type |
| 12 | Large text | Comfort mode on |
| 13 | Undo | Deleting is never a dead end |
| 14 | Progress | The season across every game — regenerate with `node trends.js` |
| 15 | His words | The same question, two sessions apart — regenerate with `node insights.js` |
