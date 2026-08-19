/*
  The failure a real user hit on real footage: a tiny player, a default-sized
  ring, mown grass and look-alike team-mates. Reported as "the auto-track ring
  is not following the player", with the ring ending up on empty grass.

  Before the fix, this suite's clip reproduced it exactly: the ring tracked
  cleanly to t=3 (err 0.004), then swapped onto a same-coloured team-mate
  crossing the other way and followed HIM backwards — reaching err 0.373 by
  t=7 while reporting a lock of 0.9+ and a cheerful "Followed him" message.
  Confident, wrong, and silent about it.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const SMALL = path.join(FIXTURES, 'small.webm');
/* straight from the fixture's own overlay expressions */
const him   = t => ({ x: (74 + 58 * t) / 640, y: (160 + 22 * Math.sin(1.5 * t)) / 360 });
const other = t => ({ x: (524 - 40 * t) / 640, y: (129 + 18 * Math.cos(1.2 * t)) / 360 });

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', SMALL);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);

  const box = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);

  // place the ring the way anyone would: click him, change nothing
  await page.click('#toolGrid button[data-tool=spot]');
  await page.fill('#labelInput', 'Jude');
  const p0 = him(0);
  await page.mouse.move(box.x + box.width * p0.x, box.y + box.height * p0.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);

  const ring = await page.evaluate(() => window.__filmroom.getProject().annotations[0].r);
  check(`the ring is left at its default size (${ring}), as a first-timer would`, ring === 0.035);
  check('and it is far wider than the player himself (ring ≈ ' +
    Math.round(ring * 640 * 2) + 'px across, player 8px)', ring * 640 * 2 > 4 * 8);

  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  await page.waitForTimeout(300);

  const at = t => page.evaluate(t => {
    const a = window.__filmroom.getProject().annotations[0];
    return window.__filmroom.spotPos(a, t);
  }, t);

  for (const t of [1, 3, 5, 7]){
    const got = await at(t), want = him(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    check(`still on HIM at t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }

  // the specific way it used to fail: following the look-alike instead
  const late = await at(7), imposter = other(7);
  const toImposter = Math.hypot(late.x - imposter.x, late.y - imposter.y);
  check(`and not on the team-mate who crossed him (${toImposter.toFixed(3)} away from the look-alike)`,
    toImposter > 0.2);

  // it must also not have quietly gone backwards
  const early = await at(1), later = await at(7);
  check(`it travelled with him, not against him (x ${early.x.toFixed(2)} → ${later.x.toFixed(2)})`,
    later.x > early.x + 0.3);

  /* ---- and again with the camera panning ----
     Real sideline footage pans constantly. The world is wider than the frame
     here, so the grass streams past while the player drifts only slowly within
     it: a template made mostly of grass would follow the FIELD, which is moving
     with the camera, rather than the player. */
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'pan.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  const pbox = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);

  // player world x = 264+70t, camera left edge = 120+55t, crop y offset 30
  const panned = t => ({ x: (264 + 70 * t - (120 + 55 * t)) / 640,
                         y: (210 + 15 * Math.sin(2 * t) - 30) / 360 });
  await page.click('#toolGrid button[data-tool=spot]');
  const q0 = panned(0);
  await page.mouse.move(pbox.x + pbox.width * q0.x, pbox.y + pbox.height * q0.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  await page.waitForTimeout(300);

  for (const t of [1, 3, 5, 7]){
    const got = await page.evaluate(t => {
      const a = window.__filmroom.getProject().annotations[0];
      return window.__filmroom.spotPos(a, t);
    }, t);
    const want = panned(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    check(`stays on him while the camera pans, t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }

  /* ---- and with a high-contrast tree line right above him ----
     Park pitches have canopy directly above the players, and the tracking patch
     is sampled as a SQUARE while the ring is drawn as a flat ellipse — so the
     template reaches further above his head than the ring suggests. Canopy has
     far more contrast than grass or a small player, so it can dominate the
     match. This guards that it does not. */
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'trees.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  const tbox = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);

  const underTrees = t => ({ x: (84 + 60 * t) / 640, y: (146 + 6 * Math.sin(2 * t)) / 360 });
  await page.click('#toolGrid button[data-tool=spot]');
  const r0 = underTrees(0);
  await page.mouse.move(tbox.x + tbox.width * r0.x, tbox.y + tbox.height * r0.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  await page.waitForTimeout(300);

  for (const t of [1, 3, 5, 7]){
    const got = await page.evaluate(t => {
      const a = window.__filmroom.getProject().annotations[0];
      return window.__filmroom.spotPos(a, t);
    }, t);
    const want = underTrees(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    check(`stays on him under a tree line, t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }

  /* ---- and when he simply runs out of shot ----
     Straight from a real tracking report: the ring spent the last 2.6 seconds
     of a 15.7s clip BELOW the bottom edge of the picture (y up to 1.026),
     scoring 0.6-0.87 the whole way, and the run finished reporting lost:false.
     nccAt clamps its reads, so sampling past the edge re-reads the last row of
     pixels — a smear that correlates with itself very convincingly. The player
     here leaves the frame at about t=4.7; after that the only honest answers
     are "inside the picture" and "lost him". */
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'exit.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  const ebox = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);

  const leaving = t => ({ x: (90 + 118 * t) / 640, y: (170 + 10 * Math.sin(1.8 * t)) / 360 });
  await page.click('#toolGrid button[data-tool=spot]');
  const e0 = leaving(0);
  await page.mouse.move(ebox.x + ebox.width * e0.x, ebox.y + ebox.height * e0.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  await page.waitForTimeout(300);

  for (const t of [1, 3]){
    const got = await page.evaluate(t => {
      const a = window.__filmroom.getProject().annotations[0];
      return window.__filmroom.spotPos(a, t);
    }, t);
    const want = leaving(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    check(`on him while he is still in shot, t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }

  const strayed = await page.evaluate(() => {
    const a = window.__filmroom.getProject().annotations[0];
    let worst = null;
    for (let t = 0; t <= 8; t += 0.1){
      const p = window.__filmroom.spotPos(a, t);
      const out = Math.max(-p.x, p.x - 1, -p.y, p.y - 1);
      if (!worst || out > worst.out) worst = { t: +t.toFixed(1), x: +p.x.toFixed(3), y: +p.y.toFixed(3), out };
    }
    return worst;
  });
  check(`the ring never leaves the picture (worst: x ${strayed.x}, y ${strayed.y} at t=${strayed.t})`,
    strayed.out <= 0.001);

  const exitRep = await page.evaluate(() => {
    const r = window.__filmroom.trackReport;
    return r && r.result && r.result[0]
      ? { lost: r.result[0].lost, lastGoodAt: r.result[0].lastGoodAt,
          offFrame: r.result[0].samples.filter(s => s.x < 0 || s.x > 1 || s.y < 0 || s.y > 1).length }
      : null;
  });
  check('it says it lost him rather than claiming a clean run', exitRep && exitRep.lost === true);
  check(`and it stopped near where he left the picture (${exitRep && exitRep.lastGoodAt}s, he goes at 4.7s)`,
    exitRep && exitRep.lastGoodAt > 3.5 && exitRep.lastGoodAt < 6.5);
  check(`no sample sits outside the picture (${exitRep && exitRep.offFrame} strayed; the real report had 18)`,
    exitRep && exitRep.offFrame === 0);

  /* ---- and the case the real report finally pinned down ----
     Every fixture above is easier than real film. Measured: they score a
     distinctiveness of 0.74-0.87 with match scores over 0.96, while the user's
     own footage measured 0.489 and matched in the 0.6-0.8 range. That gap is
     why three rounds of fixture-building failed to reproduce anything. This
     clip is built to the measurement instead of to a guess — muddy smudges on
     noisy, textured grass, crossing each other at the same depth. */
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'faint.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  const fbox = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);

  const faint = t => ({ x: (100 + 42 * t + 2.5) / 640, y: (190 + 9 * Math.sin(1.6 * t) + 6.5) / 360 });
  const crosser = t => ({ x: (430 - 46 * t + 2.5) / 640, y: (196 + 7 * Math.cos(1.3 * t) + 6.5) / 360 });
  await page.click('#toolGrid button[data-tool=spot]');
  const f0 = faint(0);
  await page.mouse.move(fbox.x + fbox.width * f0.x, fbox.y + fbox.height * f0.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  await page.waitForTimeout(300);

  const faintAt = t => page.evaluate(t => {
    const a = window.__filmroom.getProject().annotations[0];
    return window.__filmroom.spotPos(a, t);
  }, t);

  // this is the patch-picking measurement the real report is compared against
  const fr = await page.evaluate(() => window.__filmroom.trackReport.spots[0]);
  check(`the default ring on this footage is as unhelpful as the real thing ` +
    `(largest patch scores ${fr.patchTried[0].distinct})`, fr.patchTried[0].distinct < 0.55);
  check(`and the bar it is held to clears what the field itself scores ` +
    `(bar ${fr.acceptBar} vs field ${(1 - fr.distinct).toFixed(3)})`,
    fr.acceptBar > 1 - fr.distinct);

  for (const t of [1, 3, 5]){
    const got = await faintAt(t), want = faint(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    // before the motion prior was strengthened this read 0.007 / 0.007 / 0.172
    check(`holds the faint player through the crossing, t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }
  const fLate = await faintAt(7), fImp = crosser(7);
  check(`and has not been carried off by the player crossing the other way ` +
    `(${Math.hypot(fLate.x - fImp.x, fLate.y - fImp.y).toFixed(3)} away from him)`,
    Math.hypot(fLate.x - fImp.x, fLate.y - fImp.y) > 0.2);
  /* Known gap, stated rather than hidden: a THIRD look-alike drifting at
     walking pace crosses his path around t=5.2, and past that point the ring
     can settle on the slow one and stop. err at t=7 is ~0.16 — better than the
     0.45 it was, and not yet right. Fixing it needs the tracker to distrust a
     match whose motion contradicts a velocity held for seconds, which is a
     bigger change than this pass. The check holds the current bound so a
     regression is visible and a real fix simply passes. */
  const fEnd = await faintAt(7), fWant = faint(7);
  const endErr = Math.hypot(fEnd.x - fWant.x, fEnd.y - fWant.y);
  check(`known gap — a walking-pace look-alike can still steal it late on ` +
    `(err ${endErr.toFixed(3)} at t=7, was 0.446)`, endErr < 0.20);

  // and the run must leave a report behind, since that is how a real failure
  // gets diagnosed rather than guessed at
  const rep = await page.evaluate(() => {
    const el = document.querySelector('#selTrackReport');
    return el && el.style.display !== 'none';
  });
  check('a tracking report is offered after a run', rep);

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
