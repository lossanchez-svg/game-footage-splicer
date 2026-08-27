/* Guided first-run tour: the steps must advance when the user DOES the thing,
   the skip link must work, and a completed/skipped tour must never come back. */
const path = require('path');
const { APP, FIXTURES, launch, wipeWork} = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');

const stepText = page => page.textContent('#tourStep');
const bubbleVisible = page => page.evaluate(() =>
  document.querySelector('#tourBubble').style.display === 'block');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await wipeWork(page);
  await page.reload();

  // ---- step 1: open a video ----
  await page.waitForSelector('#tourBubble', { state: 'visible', timeout: 3000 }).catch(() => {});
  check('tour starts on a fresh install', await bubbleVisible(page));
  check('help modal no longer auto-opens', await page.$('#helpModal.open') === null);
  check('step 1 of 5', (await stepText(page)).includes('1 of 5'));
  check('step 1 points at the open button', await page.evaluate(() => {
    const r = document.querySelector('#tourRing').getBoundingClientRect();
    const b = document.querySelector('#bigOpen').getBoundingClientRect();
    return Math.abs(r.left - b.left) < 20 && Math.abs(r.top - b.top) < 20;
  }));
  check('the highlighted control is still clickable (ring never blocks)', await page.evaluate(() => {
    const b = document.querySelector('#bigOpen').getBoundingClientRect();
    const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return el === document.querySelector('#bigOpen') || document.querySelector('#bigOpen').contains(el);
  }));

  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);
  await page.waitForTimeout(250);
  check('opening a video advances to step 2', (await stepText(page)).includes('2 of 5'));

  // ---- step 2: play (or scrub) ----
  await page.click('#btnPlay');
  await page.waitForTimeout(300);
  check('pressing play advances to step 3', (await stepText(page)).includes('3 of 5'));
  await page.evaluate(() => document.querySelector('#video').pause());
  check('step 3 points at the Spotlight tool', await page.evaluate(() => {
    const r = document.querySelector('#tourRing').getBoundingClientRect();
    const b = document.querySelector('#toolGrid button[data-tool=spot]').getBoundingClientRect();
    return Math.abs(r.left - b.left) < 20 && Math.abs(r.top - b.top) < 20;
  }));

  // ---- step 3: place a spotlight ----
  await page.click('#toolGrid button[data-tool=spot]');
  const box = await (await page.$('#overlay')).boundingBox();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  check('placing a spotlight advances to step 4', (await stepText(page)).includes('4 of 5'));

  // ---- step 4: mark a clip; the wording follows what is left to do ----
  const msg1 = await page.textContent('#tourMsg');
  check('step 4 asks for the clip start first', /Start clip/i.test(msg1));
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkIn');
  await page.waitForTimeout(150);
  check('after marking the start it asks for the end',
    /End clip/i.test(await page.textContent('#tourMsg')));
  await page.evaluate(() => { document.querySelector('#video').currentTime = 3; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkOut');
  await page.waitForTimeout(150);
  check('after marking the end it asks to save',
    /Save clip/i.test(await page.textContent('#tourMsg')));

  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  check('the bubble hides behind a dialog', !(await bubbleVisible(page)));
  await page.fill('#clipTitle', 'First moment');
  await page.click('#clipSave');
  await page.waitForTimeout(300);
  check('saving a clip advances to step 5', (await stepText(page)).includes('5 of 5'));

  // ---- step 5: open the Clips tab -> complete ----
  await page.click('#tabs button[data-tab=clips]');
  await page.waitForTimeout(250);
  check('opening Clips finishes the tour', !(await bubbleVisible(page)));
  check('completion is remembered',
    await page.evaluate(() => localStorage.getItem('filmroom:tourDone') === '1'));

  await page.reload();
  await page.waitForTimeout(700);
  check('a finished tour never comes back', !(await bubbleVisible(page)));

  // ---- restart from Help ----
  await page.click('#btnHelp');
  await page.click('#helpTour');
  await page.waitForTimeout(250);
  check('Help restarts the walkthrough', await bubbleVisible(page));
  check('help modal closes when the walkthrough restarts',
    await page.$('#helpModal.open') === null);

  // ---- skip ----
  await page.click('#tourSkip');
  await page.waitForTimeout(200);
  check('Skip closes the tour', !(await bubbleVisible(page)));
  await page.reload();
  await page.waitForTimeout(700);
  check('a skipped tour stays gone after reload', !(await bubbleVisible(page)));

  // ---- repositions on resize ----
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForSelector('#tourBubble', { state: 'visible', timeout: 3000 });
  const before = await page.evaluate(() => document.querySelector('#tourRing').getBoundingClientRect().left);
  await page.setViewportSize({ width: 800, height: 700 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const r = document.querySelector('#tourRing').getBoundingClientRect();
    const b = document.querySelector('#bigOpen').getBoundingClientRect();
    return { moved: r.left, onTarget: Math.abs(r.left - b.left) < 20 };
  });
  check('the ring follows its control across a resize (' + Math.round(before) + ' → ' +
    Math.round(after.moved) + ')', after.onTarget);

  // ---- touch: a tap advances the tour the same way ----
  const tctx = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 800 } });
  const tp = await tctx.newPage();
  await tp.goto(APP);
  await wipeWork(tp);
  await tp.reload();
  await tp.waitForSelector('#tourBubble', { state: 'visible', timeout: 3000 });
  await tp.setInputFiles('#fileVideo', VIDEO);
  await tp.waitForSelector('#videoWrap', { state: 'visible' });
  await tp.waitForTimeout(300);
  check('touch: opening a video advances the tour', (await tp.textContent('#tourStep')).includes('2 of 5'));
  await tp.tap('#tourSkip');
  await tp.waitForTimeout(200);
  check('touch: skip works by tap',
    await tp.evaluate(() => document.querySelector('#tourBubble').style.display !== 'block'));
  await tctx.close();

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
