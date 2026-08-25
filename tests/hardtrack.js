/*
  Hard-mode tracking suite — the conditions the v2 tracker exists for:
  fixtures/hard.webm has a small 18px ball on a NOISY green background with
  breathing exposure (brightness ±0.12 — defeats plain SAD matching), moving on
  a curve at 55px/s, and a white occluder that crosses straight over the ball
  at t≈3.7 (tests coast-through-occlusion + reacquire).
  Ball center: x(t) = 49 + 55t px, y(t) = 180 + 50*sin(1.3t) px (640x360).
  Pins "filmroom:lockonPath" to "off": since the 2026-08-25 flip detection is
  the app default, and this suite is the TEMPLATE tracker's regression suite
  (still the fallback). The detection path has its own suites.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'hard.webm');
const ballAt = t => ({ x: (49 + 55 * t) / 640, y: (180 + 50 * Math.sin(1.3 * t)) / 360 });

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); localStorage.setItem('filmroom:lockonPath', 'off'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);

  const box = await (await page.$('#overlay')).boundingBox();
  const at = f => ({ x: box.x + box.width * f.x, y: box.y + box.height * f.y });

  // spotlight the ball at t=0
  await page.click('#toolGrid button[data-tool=spot]');
  await page.fill('#labelInput', 'ball');
  const p0 = at(ballAt(0));
  await page.mouse.move(p0.x, p0.y); await page.mouse.down(); await page.mouse.up();
  check('spotlight placed', (await page.textContent('#annCount')).includes('1'));

  // window to 6s, back to 0, track
  await page.evaluate(() => { document.querySelector('#video').currentTime = 6; });
  await page.waitForTimeout(300);
  await page.click('#selEndHere');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'visible' });
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 180000 });

  const spot = await page.evaluate(() => {
    const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
    return { keys: s.keys,
      pos2: window.__filmroom.spotPos(s, 2),
      pos5: window.__filmroom.spotPos(s, 5),
      pos58: window.__filmroom.spotPos(s, 5.8) };
  });

  check(`keyframes written (${spot.keys.length})`, spot.keys.length >= 6);
  check('tracked to ~6s (through the occlusion at t≈3.7)', spot.keys[spot.keys.length - 1].t > 5.5);

  const near = (p, t, tol) => {
    const e = ballAt(t);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    console.log(`   t=${t}s: spot (${p.x.toFixed(3)}, ${p.y.toFixed(3)}) vs ball (${e.x.toFixed(3)}, ${e.y.toFixed(3)}) — err ${d.toFixed(3)}`);
    return d < tol;
  };
  check('on the ball at t=2 (noise + exposure drift)', near(spot.pos2, 2, 0.04));
  check('reacquired after the crossing — on the ball at t=5', near(spot.pos5, 5, 0.04));
  check('still locked at t=5.8', near(spot.pos58, 5.8, 0.04));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
