/* Portrait-first (v8 Sprint 2): at iPhone width the top bar is one
   thumb-scrollable row (it wrapped to five and ate half the screen), and the
   side panel can tuck down to its tab row so the video and marking controls
   get the room. Zero-loss: every control stays present, reachable, and worded. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

let errors = 0;
const check = (name, ok) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) errors++; };

(async () => {
  const { browser, page, errors: pageErrors } = await launch({
    viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(APP);
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();

  // ---- the top bar is one scrollable row, not a stack ----
  const bar = await page.evaluate(() => {
    const el = document.querySelector('#topbar');
    return { h: el.clientHeight, scrollW: el.scrollWidth, clientW: el.clientWidth };
  });
  check('the top bar is a single row (' + bar.h + 'px tall)', bar.h < 64);
  check('and it scrolls sideways to reach everything', bar.scrollW > bar.clientW);

  // ---- nothing fell off the bar: a far-right control still works ----
  await page.evaluate(() => document.querySelector('#btnHelp').scrollIntoView({ inline: 'center' }));
  await page.click('#btnHelp');
  check('a control at the far end still opens (Help)',
    await page.evaluate(() => document.querySelector('#helpModal').classList.contains('open')));
  await page.click('#helpClose');

  // ---- the Project menu opens un-clipped by the scrolling bar ----
  await page.evaluate(() => document.querySelector('#projectMenu summary').scrollIntoView({ inline: 'center' }));
  await page.click('#projectMenu summary');
  const pop = await page.evaluate(() => {
    const r = document.querySelector('#projectMenu .menuPop').getBoundingClientRect();
    const btn = document.querySelector('#btnSaveProj').getBoundingClientRect();
    return { left: r.left, right: r.right, w: innerWidth, btnVisible: btn.width > 0 && btn.top > 0 };
  });
  check('the Project menu opens fully on screen', pop.left >= 0 && pop.right <= pop.w && pop.btnVisible);
  await page.evaluate(() => { document.querySelector('#projectMenu').open = false; });

  // ---- the handle is a compact end-of-row control, not a fourth tab ----
  const widths = await page.evaluate(() => ({
    handle: document.querySelector('#sheetToggle').getBoundingClientRect().width,
    tab: document.querySelector('#tabs button[data-tab=draw]').getBoundingClientRect().width,
  }));
  check('the sheet handle stays small (' + Math.round(widths.handle) + 'px vs tab '
    + Math.round(widths.tab) + 'px)', widths.handle < widths.tab / 2);

  // ---- the fixed Project menu opens below the REAL bar, not a guessed offset ----
  await page.evaluate(() => document.querySelector('#projectMenu summary').scrollIntoView({ inline: 'center' }));
  await page.click('#projectMenu summary');
  const below = await page.evaluate(() => {
    const barBottom = document.querySelector('#topbar').getBoundingClientRect().bottom;
    const popTop = document.querySelector('#projectMenu .menuPop').getBoundingClientRect().top;
    return { barBottom, popTop };
  });
  check('the Project sheet opens below the live bar', below.popTop >= below.barBottom);
  await page.evaluate(() => { document.querySelector('#projectMenu').open = false; });

  // ---- the panel tucks down to its tab row and comes back ----
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await page.waitForTimeout(400);
  check('the sheet toggle is offered on a stacked layout', await page.isVisible('#sheetToggle'));
  const before = await page.evaluate(() => ({
    stage: document.querySelector('#stage').clientHeight,
    panel: document.querySelector('.tabPanel.active').clientHeight,
  }));
  await page.click('#sheetToggle');
  await page.waitForTimeout(300);
  const down = await page.evaluate(() => ({
    stage: document.querySelector('#stage').clientHeight,
    panelShown: !!document.querySelector('.tabPanel.active').offsetParent,
    overlayH: document.querySelector('#overlay').getBoundingClientRect().height,
    videoH: document.querySelector('#video').getBoundingClientRect().height,
  }));
  check('tucking the sheet hides the panel body', !down.panelShown);
  check('the video area grows (' + before.stage + ' -> ' + down.stage + 'px)', down.stage > before.stage);
  check('the drawing overlay refits the bigger video',
    Math.abs(down.overlayH - down.videoH) < 2 && down.overlayH > 0);
  // a PROGRAMMATIC tab switch (what a clip save does) must not undo the tuck
  await page.evaluate(() => switchTab('clips'));
  await page.waitForTimeout(150);
  check('a programmatic tab switch leaves the tuck alone', await page.evaluate(() =>
    document.body.classList.contains('sheetDown')));
  // tapping a tab is asking to see it — the sheet comes back up
  await page.click('#tabs button[data-tab=clips]');
  await page.waitForTimeout(200);
  check('tapping a tab brings the panel back', await page.evaluate(() =>
    !document.body.classList.contains('sheetDown') &&
    !!document.querySelector('#panel-clips.active').offsetParent));
  await page.click('#sheetToggle');
  await page.waitForTimeout(200);
  check('the toggle reads as "bring it back" while down',
    (await page.textContent('#sheetToggle')).trim() === '⌃');
  await page.click('#sheetToggle');
  await page.waitForTimeout(200);
  check('and toggling again restores the panel', await page.evaluate(() =>
    !!document.querySelector('.tabPanel.active').offsetParent));

  // ---- desktop keeps its side-by-side layout untouched ----
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(300);
  check('no sheet toggle on a wide screen', !(await page.isVisible('#sheetToggle')));
  check('the wide top bar wraps as before (no sideways scroll)', await page.evaluate(() => {
    const el = document.querySelector('#topbar');
    return el.scrollWidth <= el.clientWidth + 1;
  }));

  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
