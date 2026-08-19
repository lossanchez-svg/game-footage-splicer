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

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
