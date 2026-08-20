/*
  Tracking by detection (v4, Phases 2-3), driven end-to-end through the real
  app with a SCRIPTED detector: the stub returns boxes computed from the
  fixtures' own motion expressions (filtered to the crop the tracker asked
  for), so the association layer, identity-through-crossing, occlusion
  carrying, hunting, loss reporting, one-tap resume and the no-cap rule are
  all tested against answers known by construction. What the stub deliberately
  does NOT test is YOLOX's detection quality on real players — that is the
  realeval harness's question, on real clips.

  Also here: the path is OFF by default — with no opt-in flag, the template
  tracker runs even when a detector is available. That is the epic's gate:
  no synthetic fixture opens it.
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
    longBall: t => ({ x: 12 + 6.5 * t, y: 90 + 30 * Math.sin(0.4 * t) }),
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
    if (on) localStorage.setItem('filmroom:lockonPath', 'on');
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

  /* ---- S0: the gate — detection is OFF by default ---- */
  {
    const { ctx, page, errors: e2, box } = await freshPage(browser, 'two.webm', false);
    await installStub(page, [{ fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 }]);
    const p0 = ballA(0);
    await placeSpot(page, box, p0.x, p0.y, 640, 360, 'A');
    await trackSelected(page);
    const rep = await page.evaluate(() => window.__filmroom.trackReport);
    check(`OFF by default: a stubbed detector present but no opt-in runs the template path (${rep.path})`,
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
    check(`detection path ran (${rep.path})`, rep.path === 'detection');
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
    await page.evaluate(() => { document.querySelector('#video').currentTime = 6.5; });
    await page.waitForTimeout(350);
    const r65 = ballA(6.5);
    await page.mouse.move(box.x + box.width * (r65.x / 640), box.y + box.height * (r65.y / 360));
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
    const got7 = await spotAt(page, 0, 7.5), want7 = ballA(7.5);
    const err7 = Math.hypot(got7.x - want7.x / 640, got7.y - want7.y / 360);
    check(`and he is tracked again after the resume (t=7.5, err ${err7.toFixed(3)})`, err7 < 0.04);
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

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
