/*
  Auto-track suite: fixtures/ball.webm has a red 36px ball on a plain green
  background whose CENTER moves on a curve: x(t) = 58 + 40t px,
  y(t) = 180 + 60*sin(t) px (640x360).
  We spotlight the ball at t=0, set the spotlight's End to 6s, run Auto-track,
  and assert the interpolated spotlight position stays on the ball.
  Pins "filmroom:lockonPath" to "off": since the 2026-08-25 flip detection is
  the app default, and this suite is the TEMPLATE tracker's regression suite
  (still the fallback). The detection path has its own suites.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'ball.webm');
const ballAt = t => ({ x: (58 + 40 * t) / 640, y: (180 + 60 * Math.sin(t)) / 360 });

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

  // extend its window to 6s, return to 0
  await page.evaluate(() => { document.querySelector('#video').currentTime = 6; });
  await page.waitForTimeout(300);
  await page.click('#selEndHere');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);

  // run the tracker
  check('track button visible for spots', await page.isVisible('#selTrack'));
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'visible' });
  check('progress pill shown', true);
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 120000 });

  const spot = await page.evaluate(() => {
    const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
    return { keys: s.keys, at: t => null, // functions don't serialize; sample below
      pos3: window.__filmroom.spotPos(s, 3), pos5: window.__filmroom.spotPos(s, 5),
      pos55: window.__filmroom.spotPos(s, 5.5) };
  });

  check(`keyframes written (${spot.keys.length})`, spot.keys.length >= 4); // curved path must survive thinning
  check(`keyframes thinned (${spot.keys.length} <= 40)`, spot.keys.length <= 40);
  check('tracked to ~6s', spot.keys[spot.keys.length - 1].t > 5.5);

  const near = (p, t, tol) => {
    const e = ballAt(t);
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    console.log(`   t=${t}s: spot (${p.x.toFixed(3)}, ${p.y.toFixed(3)}) vs ball (${e.x.toFixed(3)}, ${e.y.toFixed(3)}) — err ${d.toFixed(3)}`);
    return d < tol;
  };
  check('on the ball at t=3', near(spot.pos3, 3, 0.05));
  check('on the ball at t=5', near(spot.pos5, 5, 0.05));
  check('on the ball at t=5.5', near(spot.pos55, 5.5, 0.05));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
