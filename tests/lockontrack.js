/*
  Tracking by detection (v4, Phases 2-3), driven end-to-end through the real
  app with a SCRIPTED detector: the stub returns boxes computed from the
  fixtures' own motion expressions (filtered to the crop the tracker asked
  for), so the association layer, identity-through-crossing, occlusion
  carrying, hunting, loss reporting, one-tap resume and the no-cap rule are
  all tested against answers known by construction. What the stub deliberately
  does NOT test is YOLOX's detection quality on real players — that is the
  realeval harness's question, on real clips.

  Also here: detection is the DEFAULT since the 2026-08-25 flip (the real-clip
  eval showed it beating the template tracker on every acceptance clip), and
  localStorage "filmroom:lockonPath" = "off" restores the template tracker.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const ballA = t => ({ x: 58 + 40 * t, y: 180 + 60 * Math.sin(t) });        // two.webm red
const ballB = t => ({ x: 578 - 45 * t, y: 108 + 50 * Math.cos(1.1 * t) }); // two.webm blue
const longBall = t => ({ x: 12 + 6.5 * t, y: 90 + 30 * Math.sin(0.4 * t) }); // long.webm
const smHim = t => ({ x: 74 + 58 * t, y: 160 + 22 * Math.sin(1.5 * t) });  // small.webm him
const smOther = t => ({ x: 524 - 40 * t, y: 129 + 18 * Math.cos(1.2 * t) }); // his look-alike
/* a same-kit player on HIS OWN line, crossing him tightly at t~4.6 — the case
   the check-this-moment flag exists for (smOther passes 31px above, too far) */
const smNear = t => ({ x: 524 - 40 * t, y: 160 + 22 * Math.sin(1.5 * t) });

/* install a scripted detector in the page. spec = list of
   { fn: name of a path function above, size, drop: [t0, t1] windows } */
const STUB = `(spec) => {
  const paths = {
    ballA: t => ({ x: 58 + 40 * t, y: 180 + 60 * Math.sin(t) }),
    ballB: t => ({ x: 578 - 45 * t, y: 108 + 50 * Math.cos(1.1 * t) }),
    /* the match ball (v6): with B early, at A's feet 2..5s, cleared away after */
    matchBall: t => (t < 2 ? { x: 578 - 45 * t, y: 108 + 50 * Math.cos(1.1 * t) }
      : t <= 5 ? { x: 58 + 40 * t, y: 180 + 60 * Math.sin(t) }
      : { x: 600, y: 60 }),
    /* stands still for 4s, then runs (v6-C: a clip with quiet air to trim) */
    parkThenRun: t => (t < 4 ? { x: 100, y: 180 } : { x: 100 + 55 * (t - 4), y: 180 }),
    longBall: t => ({ x: 12 + 6.5 * t, y: 90 + 30 * Math.sin(0.4 * t) }),
    /* a same-kit team-mate who walks into shot while he is out of it (S11) */
    longTwin: t => ({ x: 280 - 3 * t, y: 60 }),
    smHim: t => ({ x: 74 + 58 * t, y: 160 + 22 * Math.sin(1.5 * t) }),
    smOther: t => ({ x: 524 - 40 * t, y: 129 + 18 * Math.cos(1.2 * t) }),
    smNear: t => ({ x: 524 - 40 * t, y: 160 + 22 * Math.sin(1.5 * t) }),
  };
  window.__stubSpec = spec;
  window.__filmroom.lockon.stub(async (src, cx, cy, crop) => {
    const t = document.querySelector('#video').currentTime;
    const out = [];
    for (const s of window.__stubSpec){
      if ((s.drop || []).some(w => t >= w[0] && (w[1] == null || t <= w[1]))) continue;
      const c = paths[s.fn](t);
      if (s.kind === 'ball'){
        // a ball box is centred on the ball, not bottom-anchored like a body
        const bb = { x: c.x - s.size / 2, y: c.y - s.size / 2,
                     w: s.size, h: s.size, score: s.score || 0.5, kind: 'ball' };
        if (Math.abs((bb.x + bb.w / 2) - cx) > crop / 2 + s.size) continue;
        if (Math.abs((bb.y + bb.h / 2) - cy) > crop / 2 + s.size) continue;
        out.push(bb);
        continue;
      }
      // the ring goes at box-bottom (his feet), so build the box around that
      // bottom-anchored so (y + 0.95h) === c.y — the ring marks his feet
      const b = { x: c.x - s.size / 2, y: c.y - s.size * 0.95,
                  w: s.size, h: s.size, score: s.score || 0.85 };
      if (s.sig) b.sig = s.sig.slice();   // controlled kit colour (else: real pixels)
      if (Math.abs((b.x + b.w / 2) - cx) > crop / 2 + s.size) continue;
      if (Math.abs((b.y + b.h / 2) - cy) > crop / 2 + s.size) continue;
      out.push(b);
    }
    return out;
  });
}`;

const installStub = (page, spec) =>
  page.evaluate(`(${STUB})(${JSON.stringify(spec)})`);

async function freshPage(browser, fixture, pathOn){
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  await page.goto(APP);
  await page.evaluate(on => {
    localStorage.clear();
    localStorage.setItem('filmroom:tourDone', '1');
    if (!on) localStorage.setItem('filmroom:lockonPath', 'off');   // detection is the default
  }, pathOn);
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, fixture));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 1);
  const box = await (await page.$('#overlay')).boundingBox();
  return { ctx, page, errors, box };
}

async function placeSpot(page, box, px, py, W, H, label, at = 0){
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at);
  await page.waitForTimeout(300);
  await page.click('#toolGrid button[data-tool=spot]');
  if (label) await page.fill('#labelInput', label);
  await page.mouse.move(box.x + box.width * (px / W), box.y + box.height * (py / H));
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
}

async function trackSelected(page, n = 0, timeout = 600000, btn = '#selTrack'){
  await page.click('#toolGrid button[data-tool=select]');
  await page.click(`#annList .annItem .kind >> nth=${n}`);
  await page.click(btn);
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout });
  await page.waitForTimeout(300);
}

const spotAt = (page, i, t) => page.evaluate(([i, t]) => {
  const spots = window.__filmroom.getProject().annotations.filter(a => a.type === 'spot');
  return window.__filmroom.spotPos(spots[i], t);
}, [i, t]);

(async () => {
  const { browser, page, errors, check } = await launch();
  await page.close();   // scenarios each get a fresh context

  /* ---- S0: the off switch — "filmroom:lockonPath"="off" restores v3.7 ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', false);
    await installStub(page, [{ fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 }]);
    const p0 = ballA(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'A');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`the off switch restores the template tracker (${rep.path})`,
      rep.path === 'template');
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S1: identity through a crossing, then both players in one pass ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', true);
    await installStub(page, [{ fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 }]);
    const p0 = ballA(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'A');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`detection path ran BY DEFAULT, no flag set (${rep.path})`, rep.path === 'detection');
    check(`follows to the end of the clip (stopBecause ${rep.spots[0].stopBecause})`,
      rep.spots[0].stopBecause === 'clipEnd');
    check('run not reported lost', rep.result[0].lost === false);
    for (const t of [1, 3, 5, 7]){
      const got = await spotAt(page, 0, t), want = ballA(t);
      const err = Math.hypot(got.x - want.x / 640, got.y - want.y / 360);
      check(`on HIM at t=${t} (err ${err.toFixed(3)})`, err < 0.035);
    }
    const at7 = await spotAt(page, 0, 7), b7 = ballB(7);
    const toB = Math.hypot(at7.x - b7.x / 640, at7.y - b7.y / 360);
    check(`did not swap onto the crossing player (${toB.toFixed(3)} away from him)`, toB > 0.2);

    // both players, one pass
    const q0 = ballB(0);
    await placeSpot(page, box, q0.x, q0.y, 640, 360, 'B');
    await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
    await page.waitForTimeout(300);
    check('Follow-everyone offered with two rings live', await page.isVisible('#btnTrackAll'));
    await page.click('#btnTrackAll');
    await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 600000 });
    await page.waitForTimeout(300);
    for (const t of [6, 7.5]){
      const gA = await spotAt(page, 0, t), gB = await spotAt(page, 1, t);
      const eA = Math.hypot(gA.x - ballA(t).x / 640, gA.y - ballA(t).y / 360);
      const eB = Math.hypot(gB.x - ballB(t).x / 640, gB.y - ballB(t).y / 360);
      check(`both tracked in one pass, each on his own after the crossing (t=${t}: A ${eA.toFixed(3)}, B ${eB.toFixed(3)})`,
        eA < 0.035 && eB < 0.035);
    }
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S2: a 1.5s occlusion is carried, then re-found — not a loss ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', true);
    await installStub(page,
      [{ fn: 'ballA', size: 36, drop: [[3, 4.5]] }, { fn: 'ballB', size: 36 }]);
    const p0 = ballA(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'A');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check('hidden for 1.5s: run not reported lost', rep.result[0].lost === false);
    check(`he was re-found (${rep.result[0].refinds} refind${rep.result[0].refinds === 1 ? '' : 's'})`,
      rep.result[0].refinds >= 1);
    for (const t of [6, 7]){
      const got = await spotAt(page, 0, t), want = ballA(t);
      const err = Math.hypot(got.x - want.x / 640, got.y - want.y / 360);
      check(`back on him after the occlusion (t=${t}, err ${err.toFixed(3)})`, err < 0.04);
    }
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S3: leaving frame = honest loss, ring stays put, one-tap resume ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', true);
    await installStub(page,
      [{ fn: 'ballA', size: 36, drop: [[5, null]] }, { fn: 'ballB', size: 36 }]);
    const p0 = ballA(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'A');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check('gone for good: the run says LOST, not a cheerful finish', rep.result[0].lost === true);
    check(`loss placed within 1s of him going (last good at ${rep.result[0].lastGoodAt}s, gone at 5s)`,
      rep.result[0].lastGoodAt >= 4.5 && rep.result[0].lastGoodAt <= 6);
    const parked = await spotAt(page, 0, 7.5), lastSeen = ballA(rep.result[0].lastGoodAt);
    const dPark = Math.hypot(parked.x - lastSeen.x / 640, parked.y - lastSeen.y / 360);
    check(`the ring stays where he was last seen (${dPark.toFixed(3)} from there)`, dPark < 0.05);

    // the one-tap resume: the toast offers it, a tap stitches and carries on
    const btn = await page.waitForSelector('.toastBtn', { timeout: 5000 });
    check('the lost toast offers a way to carry on', !!btn);
    await btn.click();
    await page.evaluate(() => { window.__stubSpec[0].drop = []; });   // he is visible again
    /* tapped 2.3s after the loss — past TRACK_GAP_MIN, so the unseen stretch
       must come back as a recorded gap, not a glide */
    await page.evaluate(() => { document.querySelector('#video').currentTime = 7.3; });
    await page.waitForTimeout(350);
    const r73 = ballA(7.3);
    await page.mouse.move(box.x + box.width * (r73.x / 640), box.y + box.height * (r73.y / 360));
    await page.mouse.down(); await page.mouse.up();
    await page.waitForSelector('#trackPill', { state: 'visible', timeout: 10000 });
    await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 600000 });
    await page.waitForTimeout(300);
    const keys = await page.evaluate(() =>
      window.__filmroom.getProject().annotations.find(a => a.type === 'spot').keys.map(k => k.t));
    const sorted = keys.every((t, i) => i === 0 || t >= keys[i - 1]);
    check('resume stitched: the old path is kept and the new one continues it (' +
      keys.length + ' keys, in order: ' + sorted + ')',
      sorted && keys.some(t => t < 5) && keys.some(t => t > 7.5));
    const got7 = await spotAt(page, 0, 7.8), want7 = ballA(7.8);
    const err7 = Math.hypot(got7.x - want7.x / 640, got7.y - want7.y / 360);
    check(`and he is tracked again after the resume (t=7.8, err ${err7.toFixed(3)})`, err7 < 0.04);
    /* the resumed run CONTINUES the report the finder reads, and the stretch
       nobody saw him in is a gap on the ring — not a glide across the grass */
    const st = await page.evaluate(() => {
      const rep = window.__filmroom.trackReport;
      const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
      const ts = rep.result[0].samples.map(x => x.t);
      return { stitched: rep.stitched, startedAt: rep.startedAt, first: Math.min(...ts), last: Math.max(...ts),
               repGaps: rep.result[0].gaps, spotGaps: s.gaps,
               hiddenIn: window.__filmroom.spotHidden(s, 6.5), shownAfter: window.__filmroom.spotHidden(s, 7.6),
               shownBefore: window.__filmroom.spotHidden(s, 3) };
    });
    check(`the resumed run joined the first one's report (stitched ${st.stitched}, from ${st.startedAt}s, samples ${st.first}–${st.last}s)`,
      st.stitched === 1 && st.startedAt < 0.5 && st.first < 1 && st.last > 7.5);
    const g = (st.repGaps || [])[0];
    check(`the report records the unseen stretch as a gap (${JSON.stringify(st.repGaps)})`,
      !!g && g.from >= 4.5 && g.from <= 6 && Math.abs(g.to - 7.3) < 0.2);
    check(`the ring carries the same gap (${JSON.stringify(st.spotGaps)})`,
      Array.isArray(st.spotGaps) && st.spotGaps.length === 1 && Math.abs(st.spotGaps[0].to - 7.3) < 0.2);
    check('and draws nothing inside it, everything outside it',
      st.hiddenIn === true && st.shownAfter === false && st.shownBefore === false);
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S10: gone for 8 seconds, back alone — the run carries on by itself ----
     The hunt used to give up after 5s and hand the parent a tap. Now it keeps
     looking (30s), and a re-find past the local window has to be the ONLY
     wearer of his kit seen anywhere in a full sweep. He is, so the run stitches
     itself, records the 8s as a gap, and draws no ring across it. */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'long.webm', true);
    await installStub(page, [{ fn: 'longBall', size: 16, drop: [[5, 13]] }]);
    const p0 = longBall(0);
    await placeSpot(page, box, p0.x, p0.y, 320, 180, 'far');
    await trackSelected(page);
    const r = await page.evaluate(() => {
      const rep = window.__filmroom.trackReport;
      const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
      return { lost: rep.result[0].lost, lastGoodAt: rep.result[0].lastGoodAt, refinds: rep.result[0].refinds,
               gaps: s.gaps, hidden9: window.__filmroom.spotHidden(s, 9), shown20: window.__filmroom.spotHidden(s, 20) };
    });
    check(`an 8s absence no longer ends the run (lost ${r.lost}, last good at ${r.lastGoodAt}s, re-found ${r.refinds}x)`,
      r.lost === false && r.lastGoodAt > 39 && r.refinds === 1);
    const g = (r.gaps || [])[0];
    check(`the unseen stretch is recorded as a gap (${JSON.stringify(r.gaps)})`,
      !!g && g.from >= 4.8 && g.from <= 5.3 && g.to >= 13 && g.to <= 14.5 && r.gaps.length === 1);
    check('no ring is drawn inside the gap; it is back once he is', r.hidden9 === true && r.shown20 === false);
    for (const t of [20, 38]){
      const got = await spotAt(page, 0, t), want = longBall(t);
      const err = Math.hypot(got.x - want.x / 320, got.y - want.y / 180);
      check(`and he is followed again after it (t=${t}, err ${err.toFixed(3)})`, err < 0.04);
    }
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S11: back alongside a same-kit team-mate — the ring picks nobody ----
     Same absence, but a team-mate in his colours walks into shot at the same
     time. Two wearers anywhere in the frame means the far re-find is refused
     every step; the hunt runs its 30s out and the run ends honestly LOST with
     the ring parked where he was last seen. Never a silent swap. */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'long.webm', true);
    const kit = [0.5, 0.3, 0.2, 0.4, 0.3, 0.3];
    await installStub(page, [
      { fn: 'longBall', size: 16, sig: kit, drop: [[5, 13]] },
      { fn: 'longTwin', size: 16, sig: kit, drop: [[0, 13]] },
    ]);
    const p0 = longBall(0);
    await placeSpot(page, box, p0.x, p0.y, 320, 180, 'far');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`two wearers of his kit: the run ends LOST rather than guessing (lost ${rep.result[0].lost}, re-found ${rep.result[0].refinds}x)`,
      rep.result[0].lost === true && rep.result[0].refinds === 0);
    check(`the loss is placed where he actually went (last good at ${rep.result[0].lastGoodAt}s, gone at 5s)`,
      rep.result[0].lastGoodAt >= 4.5 && rep.result[0].lastGoodAt <= 6);
    const parked = await spotAt(page, 0, 30), lastSeen = longBall(rep.result[0].lastGoodAt);
    const dPark = Math.hypot(parked.x - lastSeen.x / 320, parked.y - lastSeen.y / 180);
    check(`the ring stays where he was last seen, not on the team-mate (${dPark.toFixed(3)} from there)`, dPark < 0.05);
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S4: the 25-second cap is gone — a 40s clip end to end ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'long.webm', true);
    await installStub(page, [{ fn: 'longBall', size: 16 }]);
    const p0 = longBall(0);
    await placeSpot(page, box, p0.x, p0.y, 320, 180, 'far');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`no 25s cap: bounded by the clip, not a counter (stopBecause ${rep.spots[0].stopBecause})`,
      rep.spots[0].stopBecause === 'clipEnd');
    check(`a 40-second clip tracked end to end (last good at ${rep.result[0].lastGoodAt}s)`,
      rep.result[0].lastGoodAt > 39);
    for (const t of [10, 25, 38]){
      const got = await spotAt(page, 0, t), want = longBall(t);
      const err = Math.hypot(got.x - want.x / 320, got.y - want.y / 180);
      check(`still on him at t=${t} (err ${err.toFixed(3)})`, err < 0.04);
    }
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S5: same-kit crossing is FLAGGED, not guessed through silently ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'small.webm', true);
    const kit = [0.5, 0.3, 0.2, 0.4, 0.3, 0.3];   // both wear exactly the same kit
    await installStub(page,
      [{ fn: 'smHim', size: 20, sig: kit }, { fn: 'smNear', size: 20, sig: kit }]);
    const p0 = smHim(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'Jude');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    const unc = rep.result[0].uncertain || [];
    check(`the same-kit crossing (~t=4.6) is flagged as a check-this moment (${JSON.stringify(unc)})`,
      unc.some(u => u.at > 3.2 && u.at < 5.8));
    const got7 = await spotAt(page, 0, 7), want7 = smHim(7);
    const err7 = Math.hypot(got7.x - want7.x / 640, got7.y - want7.y / 360);
    check(`and motion still carried him through it (t=7, err ${err7.toFixed(3)})`, err7 < 0.04);
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S6: nobody detected at the ring -> template tracker, by itself ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'ball.webm', true);
    await installStub(page, []);   // a detector that sees nothing
    await placeSpot(page, box, 58, 180, 640, 360, 'ball');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`detector sees nobody: falls back to the template path on its own (${rep.path})`,
      rep.path === 'template');
    const keys = await page.evaluate(() =>
      window.__filmroom.getProject().annotations[0].keys.length);
    check(`and tracking still worked (${keys} keys)`, keys >= 4);
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- S7: backwards from an anchor, through the crossing ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', true);
    await installStub(page, [{ fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 }]);
    const p75 = ballA(7.5);
    await placeSpot(page, box, p75.x, p75.y, 640, 360, 'A', 7.5);
    await trackSelected(page, 0, 600000, '#selTrackBack');
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`worked backwards on the detection path (${rep.path}, ${rep.direction})`,
      rep.path === 'detection' && rep.direction === 'backward');
    for (const t of [1, 3, 6]){
      const got = await spotAt(page, 0, t), want = ballA(t);
      const err = Math.hypot(got.x - want.x / 640, got.y - want.y / 360);
      check(`the run behind the anchor is HIS, back through the crossing (t=${t}, err ${err.toFixed(3)})`,
        err < 0.035);
    }
    const spotState = await page.evaluate(() => {
      const sp = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
      const ordered = sp.keys.every((k, i) => i === 0 || k.t >= sp.keys[i - 1].t);
      return { tStart: sp.tStart, ordered };
    });
    check(`keys stored in time order after a backwards run (${spotState.ordered})`, spotState.ordered);
    check(`the ring is shown for the run it now carries (tStart ${spotState.tStart.toFixed(2)})`,
      spotState.tStart < 0.5);
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- association unit checks: motion keeps identity, colour splits teams ---- */
  {
    const ctx = await browser.newContext();
    const page2 = await ctx.newPage();
    await page2.goto(APP);
    const r = await page2.evaluate(() => {
      const step = window.__filmroom.lockon.step;
      const red = [0.6, 0.2, 0.2, 0.5, 0.25, 0.25], blue = [0.2, 0.2, 0.6, 0.25, 0.25, 0.5];
      // two same-kit tracks about to cross: velocity must keep identities apart
      const A = { x: 100, y: 100, w: 20, h: 40, vx: 10, vy: 0, sig: red.slice() };
      const B = { x: 140, y: 100, w: 20, h: 40, vx: -10, vy: 0, sig: red.slice() };
      const dA = { x: 100, y: 80, w: 20, h: 40, sig: red.slice(), score: 0.9 };  // centre 110
      const dB = { x: 120, y: 80, w: 20, h: 40, sig: red.slice(), score: 0.9 };  // centre 130
      const m1 = step([A, B], [dA, dB], 100).matches;
      const okMotion = m1.length === 2 &&
        m1.find(m => m.tr === A).d === dA && m1.find(m => m.tr === B).d === dB;
      // opposite kits: colour overrides a small distance advantage
      const C = { x: 100, y: 100, w: 20, h: 40, vx: 0, vy: 0, sig: red.slice() };
      const dNearBlue = { x: 92, y: 80, w: 20, h: 40, sig: blue.slice(), score: 0.9 };
      const dFarRed = { x: 110, y: 80, w: 20, h: 40, sig: red.slice(), score: 0.9 };
      const m2 = step([C], [dNearBlue, dFarRed], 100).matches;
      const okColour = m2.length === 1 && m2[0].d === dFarRed;
      const margined = m1.every(m => typeof m.margin === 'number');
      return { okMotion, okColour, margined };
    });
    check('association: velocity keeps two same-kit tracks on their own detections through a crossing', r.okMotion);
    check('association: kit colour outweighs a small distance advantage across teams', r.okColour);
    check('association: every match carries its contested-margin', r.margined);
    await ctx.close();
  }

  /* ---- S9 (v6-A): the ball joins the tracks, and possession falls out ----
     A scripted ball travels with player B early, sits at A's feet from 2s to
     5s, then is cleared away. Tracking A must: keep following A exactly as
     before (the ball never enters player association), record the ball's own
     path, and report one possession window over the constructed 2..5s. */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', true);
    await installStub(page, [
      { fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 },
      { fn: 'matchBall', size: 10, kind: 'ball', score: 0.5 },
    ]);
    const p0 = ballA(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'A');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check('the ball never steals the player track (still on A, not lost)',
      rep.result[0].lost === false);
    const got3 = await spotAt(page, 0, 3), want3 = ballA(3);
    const err3 = Math.hypot(got3.x - want3.x / 640, got3.y - want3.y / 360);
    check(`tracking is unchanged with a ball in every frame (t=3 err ${err3.toFixed(3)})`, err3 < 0.04);
    /* the crops follow the PLAY, so ball coverage is near-play coverage by
       design: this ball is near A only during the built 2..5s window (24 of
       64 steps) — the record must show exactly that, not pretend more */
    check(`the ball is recorded when near the play and only then (${rep.ball.samples.length} samples, coverage ${rep.ball.coverage})`,
      rep.ball && rep.ball.samples.length >= 20 && rep.ball.samples.length <= 30 &&
      rep.ball.coverage > 0.28 && rep.ball.coverage < 0.55);
    check('every ball sample sits inside the possession stretch it was built for',
      rep.ball.samples.every(s => s.t >= 1.8 && s.t <= 5.3));
    const pw = rep.result[0].possession;
    check(`possession is one window where the ball was built to be his (${JSON.stringify(pw)})`,
      Array.isArray(pw) && pw.length === 1 &&
      Math.abs(pw[0].start - 2) < 0.5 && Math.abs(pw[0].end - 5) < 0.5);
    errors.push(...e2);
    await ctx.close();
  }

  /* ---- possession windows: pure checks with answers known by construction ---- */
  {
    const { ctx, page } = await freshPage(browser, 'two.webm', true);
    const r = await page.evaluate(() => {
      const poss = window.__filmroom.lockon.possession;
      const his = []; for (let t = 0; t <= 10; t += 0.25) his.push({ t, x: 0.1 + 0.05 * t, y: 0.5 });
      const withHim = his.filter(s => s.t >= 3 && s.t <= 6).map(s => ({ t: s.t, x: s.x + 0.01, y: s.y }));
      const far = his.map(s => ({ t: s.t, x: s.x + 0.4, y: s.y }));
      const blip = [{ t: 2, x: 0.2, y: 0.5 }];
      const gapped = [...his.filter(s => s.t >= 1 && s.t <= 2), ...his.filter(s => s.t >= 2.4 && s.t <= 3.4)]
        .map(s => ({ t: s.t, x: s.x, y: s.y }));
      return {
        win: poss(his, withHim),
        none: poss(his, far),
        blip: poss(his, blip),
        joined: poss(his, gapped),
      };
    });
    check(`a ball at his feet for 3s is one window (${JSON.stringify(r.win)})`,
      r.win.length === 1 && Math.abs(r.win[0].start - 3) < 0.3 && Math.abs(r.win[0].end - 6) < 0.3);
    check('a ball across the pitch is never possession', r.none.length === 0);
    check('a single blip is too short to count', r.blip.length === 0);
    check(`a short dropout joins into one window, not two (${JSON.stringify(r.joined)})`,
      r.joined.length === 1 && Math.abs(r.joined[0].end - r.joined[0].start - 2.4) < 0.3);
    await ctx.close();
  }

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
