/*
  Proves the eval harness itself before any real clip goes through it — a
  harness that cannot catch a failure would wave every tracker change through,
  which is exactly the kind of instrument error that cost v2.5-v3.7 nine
  builds. Two halves:

  1. Scoring, on fabricated paths where the right answer is known by
     construction: a perfect track scores perfect; a ring that follows the
     look-alike after a crossing is counted as an identity switch; a tracker
     that honestly reports "lost" scores BETTER than one that silently parks
     the ring (the epic's core invariant, encoded in the scorer); an
     off-frame window excludes scoring; the ship/no-ship gate calls WIN, TIE
     and LOSS correctly.

  2. The whole pipeline, on a real tracking run: a synthetic case is built
     from small.webm with ground truth generated from the fixture's own
     motion expressions (the same numbers smalltrack.js asserts against), and
     runCase() must discover it, drive the app, and come back with the
     numbers v3.7 is known to produce there.
*/
'use strict';
const path = require('path');
const fs = require('fs');
const { FIXTURES } = require('../common');
const { interp, scoreCase, compareCase, scoreBall } = require('./score');
const { discoverCases, runCase } = require('./run');

let failures = 0;
const check = (name, cond) => {
  console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
  if (!cond) failures++;
};

/* ---------- 1. scoring on fabricated paths ---------- */

const line = (f, t0, t1, dt) => {
  const ks = [];
  for (let t = t0; t <= t1 + 1e-9; t += dt) ks.push({ t: +t.toFixed(3), ...f(t) });
  return ks;
};

// interpolation mirrors the app's spotPos
{
  const ks = [{ t: 0, x: 0, y: 0 }, { t: 2, x: 1, y: 0.5 }];
  const m = interp(ks, 1);
  check('interp: midpoint is halfway', Math.abs(m.x - 0.5) < 1e-9 && Math.abs(m.y - 0.25) < 1e-9);
  check('interp: clamps before the first key', interp(ks, -5).x === 0);
  check('interp: clamps after the last key', interp(ks, 99).x === 1);
}

const him = t => ({ x: 0.1 + 0.08 * t, y: 0.5 });
const decoy = t => ({ x: 0.9 - 0.08 * t, y: 0.5 });

// a perfect track is a perfect score
{
  const gt = line(him, 0, 10, 0.25);
  const m = scoreCase({ gtKeys: gt, trackedKeys: gt.slice(), anchor: 0, decoys: [] });
  check(`perfect track: mean err 0 (${m.meanErr})`, m.meanErr < 1e-6);
  check('perfect track: on him 100%', m.onHimPct === 100);
  check('perfect track: full coverage', m.coverage === 1);
  check('perfect track: no switches', m.switches === 0);
}

// following the look-alike after a crossing is an identity switch
{
  const gt = line(him, 0, 10, 0.25);
  const d = line(decoy, 0, 10, 0.25);
  const wrong = line(t => (t <= 5 ? him(t) : decoy(t)), 0, 10, 0.25);
  const m = scoreCase({ gtKeys: gt, trackedKeys: wrong, anchor: 0,
    decoys: [{ label: 'look-alike', keys: d }] });
  check(`switched track: exactly one switch event (${m.switches})`, m.switches === 1);
  check(`switched track: time on the wrong player counted (${m.switchTime}s)`, m.switchTime >= 3);
  check(`switched track: on-him share drops (${m.onHimPct}%)`, m.onHimPct < 60);
  const clean = scoreCase({ gtKeys: gt, trackedKeys: gt.slice(), anchor: 0,
    decoys: [{ label: 'look-alike', keys: d }] });
  check('the crossing instant alone does not count against a clean track', clean.switches === 0);
}

// honesty beats bluffing: "lost at 5s" scores better than a silent parked ring
{
  const gt = line(him, 0, 10, 0.25);
  const half = line(him, 0, 5, 0.25);
  const honest = scoreCase({ gtKeys: gt, trackedKeys: half, anchor: 0, decoys: [],
    report: { lost: true, lastGoodAt: 5 } });
  const silent = scoreCase({ gtKeys: gt, trackedKeys: half, anchor: 0, decoys: [],
    report: { lost: false, lastGoodAt: 10 } });
  check(`honest loss stops charging error (mean ${honest.meanErr})`, honest.meanErr < 0.01);
  check(`honest loss accrues lost time (${honest.lostTime}s)`, honest.lostTime >= 4);
  check(`a silently parked ring keeps charging error (mean ${silent.meanErr})`, silent.meanErr > 0.08);
  check('so honesty scores strictly better than bluffing', honest.meanErr < silent.meanErr);
  check(`and coverage records where the follow ended (${honest.coverage})`, Math.abs(honest.coverage - 0.5) < 0.05);
}

// when he genuinely leaves frame, that window is not scorable — but the loss
// must be reported promptly, and "never said so" reads as Infinity
{
  const gt = line(him, 0, 10, 0.25);
  const toSix = line(him, 0, 6, 0.25);
  const m = scoreCase({ gtKeys: gt, trackedKeys: toSix, anchor: 0, decoys: [],
    expectLost: [[6, null]], report: { lost: true, lastGoodAt: 6.4 } });
  check(`off-frame window excluded from error (mean ${m.meanErr})`, m.meanErr < 0.01);
  check(`loss-within measured from him leaving (${m.lostWithin}s)`, m.lostWithin != null && m.lostWithin <= 1);
  const never = scoreCase({ gtKeys: gt, trackedKeys: toSix, anchor: 0, decoys: [],
    expectLost: [[6, null]], report: { lost: false, lastGoodAt: 10 } });
  check('a loss never reported reads as Infinity', never.lostWithin === Infinity);
}

// the ship/no-ship gate
{
  const a = { switches: 0, onHimPct: 95, coverage: 0.9, meanErr: 0.01, lostWithin: null };
  check('gate: identical numbers are a TIE', compareCase({ ...a }, { ...a }).verdict === 'TIE');
  check('gate: a new identity switch is a LOSS',
    compareCase({ ...a, switches: 1 }, a).verdict === 'LOSS');
  check('gate: clearly more time on him is a WIN',
    compareCase({ ...a, onHimPct: 99, coverage: 1 }, a).verdict === 'WIN');
  check('gate: seek jitter within tolerance stays a TIE',
    compareCase({ ...a, meanErr: 0.011, onHimPct: 94 }, a).verdict === 'TIE');
  check('gate: a real error regression is a LOSS',
    compareCase({ ...a, meanErr: 0.03 }, a).verdict === 'LOSS');
  /* the invariant, at the verdict level: an honest "lost him" with the ring
     ON him while it lasted must beat a wanderer that covers the whole clip
     with the ring on nobody — and must never lose to one. */
  const honest = { switches: 0, onHimPct: 90, coverage: 0.6, meanErr: 0.02, lostWithin: null };
  const wanderer = { switches: 0, onHimPct: 20, coverage: 1.0, meanErr: 0.15, lostWithin: null };
  check('gate: an honest loss with high on-him quality BEATS a full-coverage wanderer',
    compareCase(honest, wanderer).verdict === 'WIN');
  check('gate: and a wanderer can never beat it back',
    compareCase(wanderer, honest).verdict === 'LOSS');
}

// the ball scorer (v6-A): fabricated paths, answers by construction
{
  const gtBall = [];
  for (let t = 0; t <= 8; t += 0.5) gtBall.push({ t, x: 0.1 + 0.08 * t, y: 0.5 });
  const perfect = gtBall.map(k => ({ t: k.t, x: k.x, y: k.y, conf: 0.5 }));
  const p = scoreBall(gtBall, perfect);
  check(`ball: a perfect track scores perfect (coverage ${p.coverage}, err ${p.meanErr})`,
    p.coverage === 1 && p.meanErr < 0.001 && p.onBallPct === 100);
  const half = perfect.filter(s => s.t <= 4);
  const h = scoreBall(gtBall, half);
  check(`ball: recording only the first half is half the coverage (${h.coverage})`,
    h.coverage > 0.4 && h.coverage < 0.62 && h.meanErr < 0.001);
  const wrong = gtBall.map(k => ({ t: k.t, x: k.x + 0.3, y: k.y, conf: 0.5 }));
  const w = scoreBall(gtBall, wrong);
  check(`ball: a track on the wrong thing scores its error honestly (err ${w.meanErr}, on-ball ${w.onBallPct}%)`,
    w.coverage === 1 && w.meanErr > 0.25 && w.onBallPct === 0);
  check('ball: no recorded samples is zero coverage, not a crash',
    scoreBall(gtBall, []).coverage === 0 && scoreBall(gtBall, []).meanErr === null);
}

/* ---------- 2. the whole pipeline on a real tracking run ---------- */

(async () => {
  const SMALL = path.join(FIXTURES, 'small.webm');
  if (!fs.existsSync(SMALL)){
    check('small.webm fixture exists (run ./make-fixtures.sh first)', false);
    return done();
  }

  // straight from the fixture's own overlay expressions (as smalltrack.js)
  const fHim = t => ({ x: (74 + 58 * t) / 640, y: (160 + 22 * Math.sin(1.5 * t)) / 360 });
  const fOther = t => ({ x: (524 - 40 * t) / 640, y: (129 + 18 * Math.cos(1.2 * t)) / 360 });

  const caseDir = path.join(__dirname, 'out', 'selftest-clips', 'small-synthetic');
  fs.rmSync(path.join(__dirname, 'out', 'selftest-clips'), { recursive: true, force: true });
  fs.mkdirSync(caseDir, { recursive: true });
  fs.copyFileSync(SMALL, path.join(caseDir, 'small.webm'));
  const key = (f, t) => ({ t: +t.toFixed(3), x: +f(t).x.toFixed(4), y: +f(t).y.toFixed(4) });
  const keys = f => { const ks = []; for (let t = 0; t <= 7.5 + 1e-9; t += 0.25) ks.push(key(f, t)); return ks; };
  fs.writeFileSync(path.join(caseDir, 'ground-truth.filmroom.json'), JSON.stringify({
    version: 1, videoName: 'small.webm', fps: 30,
    annotations: [
      { id: 'gt1', type: 'spot', color: '#ffd400', label: 'him', r: 0.02,
        tStart: 0, tEnd: 8, keys: keys(fHim) },
      { id: 'gt2', type: 'spot', color: '#ff6a00', label: 'look-alike', r: 0.02,
        tStart: 0, tEnd: 8, keys: keys(fOther) },
    ],
    clips: [],
  }, null, 1));
  fs.writeFileSync(path.join(caseDir, 'manifest.json'), JSON.stringify({
    him: 'him', decoys: ['look-alike'],
    notes: 'selftest: synthetic ground truth over small.webm',
  }, null, 1));

  const cases = discoverCases(path.join(__dirname, 'out', 'selftest-clips'));
  check('runner discovers the case (video + ground truth + manifest)', cases.length === 1);

  console.log('   running the v3.7 tracker over it (takes a minute or two)...');
  const rc = await runCase(cases[0]);
  const m = rc.metrics;
  console.log(`   on him ${m.onHimPct}%  mean ${m.meanErr}  p90 ${m.p90Err}  coverage ${m.coverage}  switches ${m.switches}`);
  check('a build stamp came back from the app', typeof rc.build === 'string' && rc.build.startsWith('v'));
  check(`tracker held him (mean err ${m.meanErr} < 0.03)`, m.meanErr != null && m.meanErr < 0.03);
  check(`on him most of the clip (${m.onHimPct}% >= 85)`, m.onHimPct >= 85);
  check(`covered the ground-truth span (${m.coverage} >= 0.9)`, m.coverage >= 0.9);
  check(`no identity switch onto the look-alike (${m.switches})`, m.switches === 0);
  check('the app tracking report rode along', !!(rc.report && rc.report.result && rc.report.result.length));
  check('no page errors during the run', rc.pageErrors.length === 0);
  done();
})().catch(e => { console.error('FATAL', e); process.exit(2); });

function done(){
  console.log(`\n--- realeval selftest: ${failures ? failures + ' FAILURES' : 'all green'}`);
  process.exit(failures ? 1 : 0);
}
