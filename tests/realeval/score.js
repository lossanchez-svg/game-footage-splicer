/*
  Scoring for the real-footage eval harness (v4 "Lock-On", Phase 0).

  Pure functions, no browser: given a ground-truth path (hand-dragged spotlight
  keys), the path the tracker actually wrote, and what the tracker CLAIMED
  (its report), produce the numbers every tracker change is judged by.

  The scoring encodes the epic's invariants before any new tracker exists:

  - A silent identity switch scores worst of all. Samples where the ring sits
    on a labelled decoy (a ground-truth ring on the look-alike) while he is
    somewhere else are counted as switch time, and contiguous stretches count
    as switch EVENTS. Zero is the acceptance bar.
  - Admitting "lost" is cheaper than being wrong. Once the tracker reports
    lost, later samples stop charging position error and accrue lostTime
    instead. A ring parked on grass with no loss reported keeps charging full
    error. A tracker can therefore never improve its score by bluffing.
  - Coverage is how much of the ground-truth span it stayed with him (up to
    where it honestly reported lost). The v3.7 25-second cap shows up here,
    and removing it (Phase 3) must show up here too.
*/
'use strict';

/* Mirror of the app's spotPos(): linear between keys, clamped at the ends. */
function interp(keys, t){
  const k = keys;
  if (!k || !k.length) return { x: 0.5, y: 0.5 };
  if (t <= k[0].t) return { x: k[0].x, y: k[0].y };
  if (t >= k[k.length - 1].t) return { x: k[k.length - 1].x, y: k[k.length - 1].y };
  for (let i = 0; i < k.length - 1; i++){
    if (t >= k[i].t && t <= k[i + 1].t){
      const f = (t - k[i].t) / Math.max(1e-6, k[i + 1].t - k[i].t);
      return { x: k[i].x + (k[i + 1].x - k[i].x) * f,
               y: k[i].y + (k[i + 1].y - k[i].y) * f };
    }
  }
  return { x: k[k.length - 1].x, y: k[k.length - 1].y };
}

const hyp = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const inWindows = (t, ws) => (ws || []).some(w => t >= w[0] && (w[1] == null || t <= w[1]));

/*
  scoreCase({
    gtKeys,        // [{t,x,y}] hand-dragged ground truth for HIM (time-sorted)
    trackedKeys,   // [{t,x,y}] what the tracker wrote
    anchor,        // where the run started (s)
    direction,     // 1 forward | -1 backward
    tol,           // "on him" radius, normalized (default 0.03 — the suites' bound)
    step,          // sampling cadence (default 0.2s)
    expectLost,    // [[from,to|null]] windows where he is genuinely gone (off frame)
    decoys,        // [{label, keys}] ground-truth rings on look-alikes
    report,        // the app's per-spot result {lost, lastGoodAt, ...} or null
  })
*/
function scoreCase(opts){
  const tol = opts.tol || 0.03;
  const step = opts.step || 0.2;
  const dir = opts.direction || 1;
  const gt = opts.gtKeys;
  if (!gt || gt.length < 2) throw new Error('ground truth needs at least 2 keys');
  const t0 = opts.anchor != null ? opts.anchor : (dir > 0 ? gt[0].t : gt[gt.length - 1].t);
  const spanEnd = dir > 0 ? gt[gt.length - 1].t : gt[0].t;
  const span = Math.abs(spanEnd - t0);
  if (span < step) throw new Error('ground truth span is shorter than one sample step');

  const lost = !!(opts.report && opts.report.lost);
  const lastGoodAt = opts.report && opts.report.lastGoodAt != null
    ? opts.report.lastGoodAt
    : (opts.trackedKeys.length
        ? (dir > 0 ? opts.trackedKeys[opts.trackedKeys.length - 1].t : opts.trackedKeys[0].t)
        : t0);

  const samples = [];
  const errs = [];
  let onHim = 0, scored = 0, lostTime = 0;
  const switchFlags = [];   // per-sample: was the ring on a decoy while he was elsewhere?

  for (let i = 1; i * step <= span + 1e-9; i++){
    const t = t0 + dir * i * step;
    if (inWindows(t, opts.expectLost)) continue;      // he is genuinely gone: not scorable
    const g = interp(gt, t);
    const got = interp(opts.trackedKeys, t);
    const err = hyp(got, g);

    const pastLoss = lost && (dir > 0 ? t > lastGoodAt + 1e-6 : t < lastGoodAt - 1e-6);
    if (pastLoss){
      /* It said it lost him. That admission buys out of position error — the
         invariant is that honesty must always score better than bluffing. */
      lostTime += step;
      samples.push({ t: +t.toFixed(3), err: +err.toFixed(4), lost: true });
      continue;
    }
    scored++;
    errs.push(err);
    if (err < tol) onHim++;

    /* On the wrong player: near a decoy's ground-truth path AND away from him,
       at a moment when the two are actually separated (a crossing instant where
       both stand together cannot count against anyone). */
    let onDecoy = null;
    for (const d of opts.decoys || []){
      const dp = interp(d.keys, t);
      if (hyp(g, dp) > 2.5 * tol && hyp(got, dp) < tol && err > 1.5 * tol){ onDecoy = d.label; break; }
    }
    switchFlags.push(onDecoy);
    samples.push({ t: +t.toFixed(3), err: +err.toFixed(4), onDecoy: onDecoy || undefined });
  }

  /* Contiguous stretches on a decoy count as one switch EVENT (>= 2 samples,
     so a single crossing-frame blip is not called a stolen identity). */
  let switches = 0, runLen = 0, switchTime = 0;
  for (const f of switchFlags.concat([null])){
    if (f){ runLen++; switchTime += step; }
    else { if (runLen >= 2) switches++; runLen = 0; }
  }

  errs.sort((a, b) => a - b);
  const q = f => errs.length ? errs[Math.min(errs.length - 1, Math.floor(f * errs.length))] : null;
  const mean = errs.length ? errs.reduce((s, e) => s + e, 0) / errs.length : null;

  /* Coverage: how far it stayed with him before ending or honestly reporting
     lost, as a share of the ground-truth span from the anchor. */
  const followed = Math.max(0, dir > 0 ? Math.min(lastGoodAt, spanEnd) - t0
                                       : t0 - Math.max(lastGoodAt, spanEnd));
  const coverage = Math.min(1, followed / span);

  /* If he genuinely leaves (expectLost window), the acceptance bar is a loss
     reported within 1s of him going. null = no such window in this clip. */
  let lostWithin = null;
  const w0 = (opts.expectLost || []).length ? opts.expectLost[0][0] : null;
  if (w0 != null && dir > 0)
    lostWithin = lost ? +(Math.max(0, lastGoodAt - w0)).toFixed(2) : Infinity;

  return {
    span: +span.toFixed(2),
    scoredSamples: scored,
    meanErr: mean == null ? null : +mean.toFixed(4),
    medianErr: q(0.5) == null ? null : +q(0.5).toFixed(4),
    p90Err: q(0.9) == null ? null : +q(0.9).toFixed(4),
    maxErr: errs.length ? +errs[errs.length - 1].toFixed(4) : null,
    onHimPct: scored ? +(100 * onHim / scored).toFixed(1) : null,
    coverage: +coverage.toFixed(3),
    switches,
    switchTime: +switchTime.toFixed(2),
    lostReported: lost,
    lostTime: +lostTime.toFixed(2),
    lostWithin,           // seconds from him leaving frame to the loss report (Infinity = never said so)
    samples,
  };
}

/*
  The gate. A tracker change ships only if, on every clip, it beats or matches
  the baseline. "Matches" carries small tolerances so seek jitter cannot flip
  a verdict; a real regression cannot hide inside them.
*/
function compareCase(cur, base){
  const reasons = [];
  if (cur.switches > base.switches)
    reasons.push(`identity switches ${base.switches} -> ${cur.switches}`);
  if (base.onHimPct != null && cur.onHimPct != null && cur.onHimPct < base.onHimPct - 3)
    reasons.push(`on-him ${base.onHimPct}% -> ${cur.onHimPct}%`);
  if (cur.coverage < base.coverage - 0.05)
    reasons.push(`coverage ${base.coverage} -> ${cur.coverage}`);
  if (base.meanErr != null && cur.meanErr != null && cur.meanErr > base.meanErr * 1.15 + 0.003)
    reasons.push(`mean err ${base.meanErr} -> ${cur.meanErr}`);
  if (base.lostWithin != null && cur.lostWithin != null &&
      !(cur.lostWithin <= Math.max(1, base.lostWithin)))
    reasons.push(`loss reported after ${cur.lostWithin}s (was ${base.lostWithin}s)`);
  if (reasons.length) return { verdict: 'LOSS', reasons };

  const better =
    cur.switches < base.switches ||
    (base.onHimPct != null && cur.onHimPct != null && cur.onHimPct > base.onHimPct + 3) ||
    cur.coverage > base.coverage + 0.05 ||
    (base.meanErr != null && cur.meanErr != null && cur.meanErr < base.meanErr * 0.85 - 0.001);
  return { verdict: better ? 'WIN' : 'TIE', reasons: [] };
}

module.exports = { interp, scoreCase, compareCase };
