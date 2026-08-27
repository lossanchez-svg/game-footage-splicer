/* Landscape + pinch zoom (v8 Sprint 4): rotating the phone gives the film the
   height, and two fingers zoom into the players the way every photo app does.
   One finger still draws; nothing about the project or exports changes. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

let errors = 0;
const check = (name, ok) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) errors++; };

(async () => {
  const { browser, page, errors: pageErrors } = await launch({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', {
    type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })) });

  await page.goto(APP);
  await page.evaluate(() => {
    localStorage.setItem('filmroom:tourDone', '1');
    localStorage.setItem('filmroom:hint:landscape', '1');   // keep toasts out of the way
    localStorage.setItem('filmroom:hint:tool', '1');
    localStorage.setItem('filmroom:hint:spot', '1');
  });
  await page.reload();
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await page.waitForTimeout(400);
  const portraitVideoW = await page.evaluate(() =>
    document.querySelector('#video').getBoundingClientRect().width);

  // ---- two fingers zoom; nothing gets drawn by accident ----
  const c = await page.evaluate(() => {
    const r = document.querySelector('#overlay').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await touch('touchStart', [{ x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }]);
  for (let i = 1; i <= 6; i++)
    await touch('touchMove', [{ x: c.x - 30 - i * 20, y: c.y }, { x: c.x + 30 + i * 20, y: c.y }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  const zoomed = await page.evaluate(() => ({
    t: document.querySelector('#videoWrap').style.transform,
    anns: window.__filmroom.getProject().annotations.length,
    chip: !!document.querySelector('#zoomReset').offsetParent,
  }));
  check('pinching out zooms the picture (' + zoomed.t + ')', /scale\((?:[2-5]|1\.[1-9])/.test(zoomed.t));
  check('the pinch drew nothing', zoomed.anns === 0);
  check('the 1× chip appears while zoomed', zoomed.chip);

  // ---- one finger still draws, and lands where it points while zoomed ----
  await page.click('#toolGrid button[data-tool=spot]');
  const target = await page.evaluate(() => {
    const r = document.querySelector('#overlay').getBoundingClientRect();
    /* a point inside the visible part of the zoomed picture */
    const x = Math.max(r.left, 0) + 120, y = Math.max(r.top, 0) + 120;
    return { x, y, nx: (x - r.left) / r.width, ny: (y - r.top) / r.height };
  });
  await page.touchscreen.tap(target.x, target.y);
  await page.waitForTimeout(300);
  const spot = await page.evaluate(() => {
    const s = window.__filmroom.getProject().annotations.find(a => a.type === 'spot');
    return s ? s.keys[0] : null;
  });
  check('one finger still draws while zoomed', !!spot);
  check('and the ring lands where the finger pointed (' +
    (spot ? spot.x.toFixed(3) + ',' + spot.y.toFixed(3) : 'none') + ')',
    !!spot && Math.abs(spot.x - target.nx) < 0.03 && Math.abs(spot.y - target.ny) < 0.03);

  // ---- a second finger unwinds a drawing the first finger just started ----
  await page.evaluate(() => window.__filmroom.getProject().annotations.splice(0));
  await page.click('#toolGrid button[data-tool=pen]');
  await touch('touchStart', [{ x: c.x, y: c.y }]);
  await touch('touchMove', [{ x: c.x + 25, y: c.y + 25 }]);
  await touch('touchStart', [{ x: c.x, y: c.y }, { x: c.x + 80, y: c.y + 80 }]);
  await touch('touchEnd', []);
  await page.waitForTimeout(200);
  check('a second finger cancels the half-made stroke',
    await page.evaluate(() => window.__filmroom.getProject().annotations.length === 0));

  // ---- the 1× chip brings the whole picture back ----
  await page.click('#zoomReset');
  await page.waitForTimeout(150);
  check('1× resets the view', await page.evaluate(() =>
    document.querySelector('#videoWrap').style.transform === '' &&
    !document.querySelector('#zoomReset').offsetParent));

  // ---- opening a different game starts at the whole picture ----
  await touch('touchStart', [{ x: c.x - 30, y: c.y }, { x: c.x + 30, y: c.y }]);
  await touch('touchMove', [{ x: c.x - 120, y: c.y }, { x: c.x + 120, y: c.y }]);
  await touch('touchEnd', []);
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'ball.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration < 9);
  await page.waitForTimeout(500);
  check('a newly opened game starts unzoomed', await page.evaluate(() =>
    document.querySelector('#videoWrap').style.transform === ''));

  // ---- sideways: the film gets the height, the bar steps aside ----
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(400);
  const land = await page.evaluate(() => {
    const onScreen = sel => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight + 1;
    };
    return {
      bar: !!document.querySelector('#topbar').offsetParent,
      videoW: document.querySelector('#video').getBoundingClientRect().width,
      sheet: onScreen('#sheetToggle'),
      timeline: onScreen('#timeline'),
      save: onScreen('#btnSaveClip'),
      tabsOn: onScreen('#tabs'),
    };
  });
  check('sideways hides the top bar', !land.bar);
  check('rotating tucks the panel by itself', await page.evaluate(() =>
    document.body.classList.contains('sheetDown')));
  check('the film is wider than upright (' + Math.round(land.videoW) + ' vs '
    + Math.round(portraitVideoW) + 'px)', land.videoW > portraitVideoW);
  check('the timeline and Save clip are actually ON SCREEN sideways', land.timeline && land.save);
  check('the tab row is on screen too — nothing pushed off the bottom', land.tabsOn);
  check('the sheet handle is offered sideways', land.sheet);
  // the panel is one tap away even sideways
  await page.click('#tabs button[data-tab=draw]');
  await page.waitForTimeout(200);
  check('a tab tap brings the panel back sideways', await page.evaluate(() =>
    !document.body.classList.contains('sheetDown') &&
    !!document.querySelector('#panel-draw.active').offsetParent));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  check('turning upright brings the top bar back',
    await page.evaluate(() => !!document.querySelector('#topbar').offsetParent));
  check('and the panel comes back up too', await page.evaluate(() =>
    !document.body.classList.contains('sheetDown')));

  // ---- a short DESKTOP window is not a phone: the bar stays ----
  const deskCtx = await browser.newContext({ viewport: { width: 1900, height: 470 } });
  const desk = await deskCtx.newPage();
  await desk.goto(APP);
  await desk.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await desk.reload();
  check('a short desktop window keeps its top bar',
    await desk.evaluate(() => !!document.querySelector('#topbar').offsetParent));
  await deskCtx.close();

  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
