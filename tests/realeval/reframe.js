/*
  The 9:16 acceptance check (v5-F): on the REAL eval clips, does the social
  cut's auto-reframe keep him in frame ≥95% of the cut?

  Pure arithmetic, no browser: the crop simulation below is the same math the
  renderer runs (a cover-crop window whose centre follows the tracked
  spotlight path with an exponential 0.15/frame ease, clamped to the frame),
  and "him" is the hand-dragged ground truth — so this measures the question
  that matters: while the CUT plays (up to where tracking held), is the
  player the parent tracked actually inside the phone-shaped picture?

  Needs, per case in clips/: the ground-truth *.filmroom.json (as ever) and a
  tracking report in out/<case>-detect-report.json — produced by
  `node realeval/run.js --path detect`. Cases without either are skipped with
  a note. Exits 1 if any measured clip lands under 95%.
*/
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const CLIPS = path.join(ROOT, 'clips');
const OUT = path.join(ROOT, 'out');
const FPS = 30, FOLLOW = 0.08, BAR = 95;   // FOLLOW must match exportProgram's

const at = (keys, t) => {
  if (t <= keys[0].t) return keys[0];
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++){
    if (t >= keys[i].t && t <= keys[i + 1].t){
      const f = (t - keys[i].t) / Math.max(1e-6, keys[i + 1].t - keys[i].t);
      return { x: keys[i].x + (keys[i + 1].x - keys[i].x) * f,
               y: keys[i].y + (keys[i + 1].y - keys[i].y) * f };
    }
  }
  return keys[keys.length - 1];
};

function groundTruth(dir){
  const files = fs.readdirSync(dir);
  const gtFile = files.find(f => /\.filmroom\.json$/i.test(f));
  if (!gtFile) return null;
  const manifest = files.includes('manifest.json')
    ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : {};
  const proj = JSON.parse(fs.readFileSync(path.join(dir, gtFile), 'utf8'));
  const spots = (proj.annotations || []).filter(a => a.type === 'spot' && a.keys && a.keys.length >= 2);
  if (!spots.length) return null;
  let him = manifest.him
    ? spots.find(s => (s.label || '') === manifest.him)
    : spots.reduce((p, q) => (q.keys.length > p.keys.length ? q : p));
  if (!him) return null;
  const off = manifest.timeOffset || 0;
  const keys = him.keys.map(k => ({ t: k.t - off, x: k.x, y: k.y })).sort((a, b) => a.t - b.t);
  return { keys, expectLost: manifest.expectLost || [] };
}

let fails = 0, measured = 0;
for (const name of (fs.existsSync(CLIPS) ? fs.readdirSync(CLIPS) : [])){
  const dir = path.join(CLIPS, name);
  if (!fs.statSync(dir).isDirectory()) continue;
  const repFile = path.join(OUT, name + '-detect-report.json');
  if (!fs.existsSync(repFile)){
    console.log(`SKIP  ${name}: no out/${name}-detect-report.json — run realeval/run.js --path detect first`);
    continue;
  }
  const gt = groundTruth(dir);
  if (!gt){ console.log(`SKIP  ${name}: no usable ground truth`); continue; }
  const rep = JSON.parse(fs.readFileSync(repFile, 'utf8'));
  const one = rep.result && rep.result[0];
  if (!one || !one.samples || one.samples.length < 2){
    console.log(`SKIP  ${name}: report has no tracked path`); continue;
  }
  const vw = rep.video.w, vh = rep.video.h;
  const cwHalf = ((9 / 16) * (vh / vw)) / 2;    // crop half-width, normalized x

  const track = one.samples.map(s => ({ t: s.t, x: s.x, y: s.y }));
  const t0 = Math.max(track[0].t, gt.keys[0].t);
  const t1 = Math.min(one.lastGoodAt || track[track.length - 1].t,
    track[track.length - 1].t, gt.keys[gt.keys.length - 1].t);
  const outOfFrame = t => gt.expectLost.some(([a, b]) =>
    t >= a && (b == null || t <= b));

  let follow = null, inside = 0, total = 0;
  for (let t = t0; t <= t1; t += 1 / FPS){
    const target = Math.min(1 - cwHalf, Math.max(cwHalf, at(track, t).x));
    follow = follow == null ? target : follow + (target - follow) * FOLLOW;
    if (outOfFrame(t)) continue;                 // he genuinely left the picture
    total++;
    if (Math.abs(at(gt.keys, t).x - follow) <= cwHalf) inside++;
  }
  if (!total){ console.log(`SKIP  ${name}: no overlapping span to measure`); continue; }
  measured++;
  const pct = inside / total * 100;
  const ok = pct >= BAR;
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: he is inside the 9:16 crop ` +
    `${pct.toFixed(1)}% of the cut (${inside}/${total} frames over ${(t1 - t0).toFixed(1)}s; bar ${BAR}%)`);
}

if (!measured) console.log('nothing measured — add clips and run realeval/run.js --path detect');
process.exit(fails ? 1 : 0);
