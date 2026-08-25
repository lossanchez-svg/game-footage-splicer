/*
  Real-footage eval harness (v4 "Lock-On", Phase 0) — the gate every tracker
  change must pass before it ships.

  Replays real clips through the app's tracker exactly the way a person uses
  it — load the video, drop a ring on him at the anchor moment, press Follow —
  then scores the path it wrote against hand-dragged ground truth (score.js).

  Cases live in ./clips/<name>/, which is gitignored: the footage never enters
  the repo, in the same spirit as it never leaving the machine. Each case is:

    clips/<name>/
      <anything>.mp4|.mov|.m4v|.webm   the RAW footage (never an annotated
                                       export — a burned-in ring falsifies the
                                       eval; see README.md)
      <anything>.filmroom.json         the project whose hand-dragged spotlight
                                       keys are the ground truth
      manifest.json                    optional:
        { "him": "Jude",               spot label to evaluate (default: the
                                       spot with the most keys)
          "anchor": 12.4,              where the run starts (default: first key)
          "direction": 1,              1 forward (default) | -1 backwards
          "ringR": 0.02,               ring size to place (default: app default,
                                       what a first-timer gets)
          "timeOffset": 0,             subtract from project times when the clip
                                       is a trim of the original game video
          "tol": 0.03,                 "on him" radius override
          "expectLost": [[30, null]],  windows where he genuinely leaves frame
          "decoys": ["#7"],            labels of GT rings on look-alikes
          "timeoutMs": 600000 }

  Usage:
    node run.js                  run every case, print + write out/eval-<build>.json
    node run.js --case NAME      run one case
    node run.js --save-baseline  also write baseline.json (the numbers the next
                                 tracker change must beat or match)
    node run.js --gate           exit 1 if any case regresses vs baseline.json
*/
'use strict';
const path = require('path');
const fs = require('fs');
const { launch } = require('../common');
const { scoreCase, compareCase, scoreBall } = require('./score');

const ROOT = __dirname;
const CLIPS = path.join(ROOT, 'clips');
const OUT = path.join(ROOT, 'out');
const APP_DEFAULT = 'file://' + path.resolve(ROOT, '..', '..', 'index.html');

const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;

function discoverCases(clipsDir){
  if (!fs.existsSync(clipsDir)) return [];
  return fs.readdirSync(clipsDir)
    .map(d => path.join(clipsDir, d))
    .filter(d => fs.statSync(d).isDirectory())
    .map(dir => {
      const files = fs.readdirSync(dir);
      /* Prefer a .eval.webm transcode (made by prep.sh) — the test Chromium
         cannot decode H.264, real Chrome can. */
      const video =
        files.find(f => /\.eval\.webm$/i.test(f)) ||
        files.find(f => VIDEO_RE.test(f));
      const gt = files.find(f => /\.filmroom\.json$/i.test(f));
      const manifest = files.includes('manifest.json')
        ? JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) : {};
      return { name: path.basename(dir), dir,
               video: video && path.join(dir, video),
               gt: gt && path.join(dir, gt), manifest };
    })
    .filter(c => {
      if (!c.video || !c.gt){
        console.log(`SKIP  ${c.name}: needs one video file and one *.filmroom.json (has ${c.video ? 'video' : 'no video'}, ${c.gt ? 'ground truth' : 'no ground truth'})`);
        return false;
      }
      return true;
    });
}

function loadGroundTruth(c){
  const proj = JSON.parse(fs.readFileSync(c.gt, 'utf8'));
  const allSpots = (proj.annotations || []).filter(a => a.type === 'spot' && a.keys && a.keys.length >= 2);
  /* a ring labelled "ball" is BALL ground truth (v6-A) — never him, never a
     decoy: counting the ball as a look-alike would fake identity switches */
  const ballSpot = allSpots.find(s => /^ball$/i.test((s.label || '').trim()));
  const spots = allSpots.filter(s => s !== ballSpot);
  if (!spots.length) throw new Error(`${c.name}: no spotlight with >=2 keys in ${path.basename(c.gt)}`);
  const off = c.manifest.timeOffset || 0;
  const shift = s => ({ ...s, keys: s.keys.map(k => ({ t: k.t - off, x: k.x, y: k.y }))
                                          .sort((a, b) => a.t - b.t) });
  let him;
  if (c.manifest.him){
    him = spots.find(s => (s.label || '') === c.manifest.him);
    if (!him) throw new Error(`${c.name}: no spot labelled "${c.manifest.him}"`);
  } else {
    him = spots.reduce((p, q) => (q.keys.length > p.keys.length ? q : p));
  }
  const decoyLabels = c.manifest.decoys || [];
  const decoys = spots.filter(s => s !== him &&
    (decoyLabels.length ? decoyLabels.includes(s.label || '') : true))
    .map(s => ({ label: s.label || 'decoy', keys: shift(s).keys }));
  return { him: shift(him), decoys, ball: ballSpot ? shift(ballSpot).keys : null };
}

/* Drive one case through the app. Returns { trackedKeys, report, build, ringNow }. */
async function trackInApp(c, gt, opts = {}){
  const dir = c.manifest.direction || 1;
  const anchor = c.manifest.anchor != null
    ? c.manifest.anchor - (c.manifest.timeOffset || 0)
    : (dir > 0 ? gt.him.keys[0].t : gt.him.keys[gt.him.keys.length - 1].t);
  const appUrl = opts.app || APP_DEFAULT;
  const { browser, page, errors } = await launch();
  try {
    await page.goto(appUrl);
    await page.evaluate(usePath => {
      localStorage.clear();
      localStorage.setItem('filmroom:tourDone', '1');
      /* which tracker to measure. Detection is the app default since the
         2026-08-25 flip, so measuring the template tracker means forcing it
         OFF; the report's `path` field says what actually ran either way. */
      if (usePath === 'template') localStorage.setItem('filmroom:lockonPath', 'off');
      else localStorage.setItem('filmroom:lockonPath', 'on');
    }, opts.path || 'template');
    await page.reload();
    await page.setInputFiles('#fileVideo', c.video);
    await page.waitForSelector('#videoWrap', { state: 'visible', timeout: 30000 });
    try {
      await page.waitForFunction(() => {
        const v = document.querySelector('#video');
        return (v.duration > 0.5 && v.videoWidth > 0) || v.error;
      }, null, { timeout: 30000 });
    } catch (e) { /* fall through to the error check */ }
    const vErr = await page.evaluate(() => {
      const v = document.querySelector('#video');
      return v.error ? (v.error.message || 'decode error') : (v.videoWidth ? null : 'no picture');
    });
    if (vErr) throw new Error(
      `${c.name}: the video did not decode (${vErr}). The bundled test Chromium has no ` +
      `H.264 — either run ./prep.sh (transcodes to WebM next to the original) or set ` +
      `CHROME_PATH to a real Chrome/Chromium build.`);

    // to the anchor moment, ring on him, exactly as a person does it
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, anchor);
    await page.waitForTimeout(400);
    const box = await (await page.$('#overlay')).boundingBox();
    const p0 = gt.him.keys.length
      ? interpPoint(gt.him.keys, anchor)
      : { x: 0.5, y: 0.5 };
    await page.click('#toolGrid button[data-tool=spot]');
    await page.fill('#labelInput', gt.him.label || 'him');
    await page.mouse.move(box.x + box.width * p0.x, box.y + box.height * p0.y);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(250);
    if (c.manifest.ringR){
      await page.evaluate(r => {
        const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
        s.r = r;
      }, c.manifest.ringR);
    }

    await page.click('#toolGrid button[data-tool=select]');
    await page.click('#annList .annItem .kind >> nth=0');
    await page.click(dir > 0 ? '#selTrack' : '#selTrackBack');
    await page.waitForSelector('#trackPill', { state: 'visible', timeout: 15000 });
    await page.waitForSelector('#trackPill', { state: 'hidden',
      timeout: c.manifest.timeoutMs || 600000 });
    await page.waitForTimeout(300);

    const res = await page.evaluate(() => {
      const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
      return { trackedKeys: s.keys, ringNow: s.r,
               report: window.__filmroom.trackReport,
               path: window.__filmroom.trackReport && window.__filmroom.trackReport.path,
               build: window.__filmroom.build };
    });
    res.anchor = anchor; res.direction = dir;
    res.pageErrors = errors.slice();
    return res;
  } finally {
    await browser.close();
  }
}

/* tiny local copy of linear interpolation for the anchor click */
function interpPoint(keys, t){
  if (t <= keys[0].t) return keys[0];
  if (t >= keys[keys.length - 1].t) return keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++)
    if (t >= keys[i].t && t <= keys[i + 1].t){
      const f = (t - keys[i].t) / Math.max(1e-6, keys[i + 1].t - keys[i].t);
      return { x: keys[i].x + (keys[i + 1].x - keys[i].x) * f,
               y: keys[i].y + (keys[i + 1].y - keys[i].y) * f };
    }
  return keys[keys.length - 1];
}

async function runCase(c, opts = {}){
  const gt = loadGroundTruth(c);
  const r = await trackInApp(c, gt, opts);
  const spotReport = r.report && r.report.result && r.report.result[0] ? r.report.result[0] : null;
  const metrics = scoreCase({
    gtKeys: gt.him.keys,
    trackedKeys: r.trackedKeys,
    anchor: r.anchor,
    direction: r.direction,
    tol: c.manifest.tol,
    expectLost: (c.manifest.expectLost || []).map(w =>
      [w[0] - (c.manifest.timeOffset || 0), w[1] == null ? null : w[1] - (c.manifest.timeOffset || 0)]),
    decoys: gt.decoys,
    report: spotReport,
  });
  /* v6-A: when a ball ring exists in the ground truth AND the run recorded a
     ball path, score it; either half missing just means "not measured yet" */
  if (gt.ball && r.report && r.report.ball)
    metrics.ball = scoreBall(gt.ball, r.report.ball.samples);
  else if (gt.ball) metrics.ball = { note: 'ball ground truth present, but this path records no ball track' };
  return { name: c.name, build: r.build, path: r.path || 'template',
           anchor: r.anchor, direction: r.direction,
           notes: c.manifest.notes || '', metrics,
           ringNow: r.ringNow, report: r.report, pageErrors: r.pageErrors };
}

function fmtCase(rc){
  const m = rc.metrics;
  return `  ${rc.name}${rc.notes ? '  (' + rc.notes + ')' : ''}  [ran as: ${rc.path}]\n` +
    `    on him ${m.onHimPct}%   mean err ${m.meanErr}   p90 ${m.p90Err}   coverage ${Math.round(m.coverage * 100)}%\n` +
    `    switches ${m.switches}${m.switchTime ? ` (${m.switchTime}s on the wrong player)` : ''}` +
    `   ${m.lostReported ? `said lost (last good at ${rc.report && rc.report.result && rc.report.result[0] ? rc.report.result[0].lastGoodAt : '?'}s)` : 'never said lost'}` +
    (m.lostWithin != null ? `   loss reported ${m.lostWithin === Infinity ? 'NEVER' : m.lostWithin + 's'} after he left frame` : '') +
    (m.ball && m.ball.coverage != null
      ? `\n    ball: coverage ${Math.round(m.ball.coverage * 100)}%   mean err ${m.ball.meanErr}` +
        `   on-ball ${m.ball.onBallPct}%   (${m.ball.samples} samples vs ${m.ball.gtKeys} marked)` +
        (rc.report && rc.report.result && rc.report.result[0] && rc.report.result[0].possession
          ? `   possession windows ${JSON.stringify(rc.report.result[0].possession)}` : '')
      : (m.ball && m.ball.note ? `\n    ball: ${m.ball.note}` : ''));
}

async function main(){
  const args = process.argv.slice(2);
  const getArg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const only = getArg('--case');
  const gate = args.includes('--gate');
  const saveBaseline = args.includes('--save-baseline');
  const clipsDir = getArg('--clips') || CLIPS;
  const usePath = getArg('--path') || 'template';   // 'template' (v3.7) | 'detect' (v4)

  let cases = discoverCases(clipsDir);
  if (only) cases = cases.filter(c => c.name === only);
  if (!cases.length){
    console.log('No real clips to evaluate yet.');
    console.log('');
    console.log('This harness is the gate for every v4 tracker change, and it needs 3-5 real');
    console.log('clips with hand-dragged ground truth. See tests/realeval/README.md for how to');
    console.log('make one (short version: track him BY HAND in the app — those keys are the');
    console.log('ground truth — save the project, and drop the video + .filmroom.json into');
    console.log('tests/realeval/clips/<name>/). The set should include at least one same-kit');
    console.log('crossing, one occlusion, one camera pan, and one where he leaves the frame.');
    process.exit(0);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const results = [];
  for (const c of cases){
    console.log(`--- ${c.name}`);
    try {
      const rc = await runCase(c, { path: usePath });
      results.push(rc);
      /* one report per tracker path — a template report and a detection report
         for the same clip must never overwrite each other */
      fs.writeFileSync(path.join(OUT, `${c.name}-${usePath}-report.json`),
        JSON.stringify(rc.report, null, 1));
      console.log(fmtCase(rc));
      for (const e of rc.pageErrors) console.log('    PAGE ' + e);
    } catch (e) {
      console.log(`  ERROR ${e.message}`);
      results.push({ name: c.name, error: e.message });
    }
  }

  const build = (results.find(r => r.build) || {}).build || 'unknown';
  const board = { build, path: usePath, at: new Date().toISOString(),
    cases: Object.fromEntries(results.map(r => [r.name,
      r.error ? { error: r.error } : { notes: r.notes, ranAs: r.path, ...r.metrics, samples: undefined }])) };
  const outFile = path.join(OUT, `eval-${build}-${usePath}.json`);
  fs.writeFileSync(outFile, JSON.stringify(board, null, 1));
  console.log(`\nScoreboard written to ${path.relative(process.cwd(), outFile)}`);

  const basePath = path.join(ROOT, 'baseline.json');
  let regressed = false;
  if (fs.existsSync(basePath)){
    const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
    console.log(`\nAgainst baseline (${base.build}):`);
    for (const r of results){
      if (r.error){ console.log(`  ${r.name}: ERROR (${r.error})`); regressed = true; continue; }
      const b = base.cases[r.name];
      if (!b || b.error){ console.log(`  ${r.name}: no baseline — new clip`); continue; }
      const v = compareCase(r.metrics, b);
      console.log(`  ${r.name}: ${v.verdict}${v.reasons.length ? ' — ' + v.reasons.join('; ') : ''}`);
      if (v.verdict === 'LOSS') regressed = true;
    }
    console.log(regressed
      ? '\nVERDICT: regresses the baseline — this tracker change must NOT ship.'
      : '\nVERDICT: beats or matches the baseline on every clip.');
  } else {
    console.log('\n(no baseline.json yet — run with --save-baseline to set one)');
  }

  if (saveBaseline){
    fs.writeFileSync(basePath, JSON.stringify(board, null, 1));
    console.log(`Baseline saved (${build}).`);
  }
  process.exit(gate && regressed ? 1 : 0);
}

if (require.main === module) main().catch(e => { console.error('FATAL', e); process.exit(2); });

module.exports = { discoverCases, loadGroundTruth, runCase };
