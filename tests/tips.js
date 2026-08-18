/* Tooltips (hover + long-press) and the one-time contextual hints.
   Also audits that every control a first-time user can reach carries a tip. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');
const tipVisible = page => page.evaluate(() =>
  document.querySelector('#tipBubble').style.display === 'block');
const tipText = page => page.textContent('#tipBubble');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  // ---- no native title tooltips left anywhere ----
  check('no native title= tooltips remain',
    await page.evaluate(() => document.querySelectorAll('[title]').length === 0));

  // ---- hover shows a tip, after a delay, and hides again ----
  await page.hover('#btnHelp');
  await page.waitForTimeout(150);
  check('tip waits — nothing after 150ms', !(await tipVisible(page)));
  await page.waitForTimeout(450);
  check('tip appears on hover', await tipVisible(page));
  check('tip text explains the control', (await tipText(page)).toLowerCase().includes('walkthrough'));
  await page.hover('.logo');
  await page.waitForTimeout(200);
  check('tip hides when the pointer leaves', !(await tipVisible(page)));

  // ---- tips are full sentences in plain words, and every control has one ----
  const audit = await page.evaluate(() => {
    const jargon = /\bfps\b|\bmux|keyframe|normali[sz]ed|codec|H\.?264|WebCodecs|In→Out|MediaRecorder/i;
    const bad = { missing: [], short: [], jargon: [] };
    const label = el => (el.id ? '#' + el.id : el.tagName.toLowerCase() + ' “' +
      (el.textContent || '').trim().slice(0, 18) + '”');
    const visible = el => el.getClientRects().length > 0;
    for (const el of document.querySelectorAll('button, select, input[type=text], input[type=number], textarea')){
      if (el.closest('#tourBubble') || el.closest('#helpModal') || el.closest('#busyOverlay')) continue;
      if (el.closest('#panel-coach') || el.closest('#decisionOverlay')) continue;
      if (['tourSkip', 'clipCancel', 'clipSave', 'libClose', 'tagDone', 'helpClose',
           'helpTour', 'busyCancel'].includes(el.id)) continue;
      if (!visible(el) && !el.closest('#selSection') && !el.closest('#clipModal')) continue;
      const tip = el.closest('[data-tip]') && el.closest('[data-tip]').getAttribute('data-tip');
      if (!tip) { bad.missing.push(label(el)); continue; }
      if (tip.length < 25 || !/[.!?]/.test(tip)) bad.short.push(label(el));
      if (jargon.test(tip) && el.id !== 'fpsInput') bad.jargon.push(label(el) + ': ' + tip.slice(0, 40));
    }
    return bad;
  });
  check('every reachable control has a tip' +
    (audit.missing.length ? ' — missing: ' + audit.missing.join(', ') : ''), audit.missing.length === 0);
  check('tips are full sentences' +
    (audit.short.length ? ' — too terse: ' + audit.short.join(', ') : ''), audit.short.length === 0);
  check('tips avoid jargon' +
    (audit.jargon.length ? ' — ' + audit.jargon.join(' | ') : ''), audit.jargon.length === 0);

  // ---- long-press on touch ----
  const tctx = await browser.newContext({ hasTouch: true, viewport: { width: 900, height: 820 } });
  const tp = await tctx.newPage();
  await tp.goto(APP);
  await tp.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await tp.reload();
  const box = await (await tp.$('#btnHelp')).boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await tp.touchscreen.tap(cx, cy);
  await tp.waitForTimeout(200);
  check('a normal tap does NOT open a tip',
    await tp.evaluate(() => document.querySelector('#tipBubble').style.display !== 'block'));
  await tp.evaluate(() => document.querySelector('#helpModal').classList.remove('open'));

  // long-press: pointerdown, hold, pointerup
  await tp.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerType: 'touch', pointerId: 3 };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    window.__lpEl = el; window.__lpOpts = opts;
  }, { x: cx, y: cy });
  await tp.waitForTimeout(650);
  check('long-press opens the tip',
    await tp.evaluate(() => document.querySelector('#tipBubble').style.display === 'block'));
  check('long-press tip has the same words',
    (await tp.textContent('#tipBubble')).toLowerCase().includes('walkthrough'));
  await tp.evaluate(() => {
    window.__lpEl.dispatchEvent(new PointerEvent('pointerup', window.__lpOpts));
    window.__lpEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await tp.waitForTimeout(150);
  check('the long-press did not also press the button',
    await tp.$('#helpModal.open') === null);
  await tctx.close();

  // ---- one-time hints ----
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  const toasts = () => page.evaluate(() =>
    [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));

  await page.click('#toolGrid button[data-tool=spot]');
  await page.waitForTimeout(150);
  check('first tool pick hints where to draw', (await toasts()).includes('tap or drag on the video'));

  const b = await (await page.$('#overlay')).boundingBox();
  await page.mouse.move(b.x + b.width * 0.4, b.y + b.height * 0.5);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(200);
  check('first spotlight hints at auto-track', (await toasts()).includes('Auto-track'));

  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(120);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 3; });
  await page.waitForTimeout(120);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'A moment');
  await page.click('#clipSave');
  await page.waitForTimeout(250);
  check('first saved clip says where it went', (await toasts()).includes('Clips tab'));

  await page.click('#clipList [data-act=reel]');
  await page.waitForTimeout(250);
  check('first reel add explains both next steps',
    /Save as one video/.test(await toasts()) && /Watch together/.test(await toasts()));

  // each hint fires once only — repeat the same actions, no repeat toast
  await page.evaluate(() => [...document.querySelectorAll('.toast')].forEach(t => t.remove()));
  await page.click('#tabs button[data-tab=draw]');
  await page.click('#toolGrid button[data-tool=arrow]');
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#clipList [data-act=reel]');   // remove
  await page.click('#clipList [data-act=reel]');   // add again
  await page.waitForTimeout(250);
  const repeat = await toasts();
  check('hints do not fire a second time',
    !repeat.includes('tap or drag on the video') && !repeat.includes('Export reel'));

  // ...and not after a reload either
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.evaluate(() => [...document.querySelectorAll('.toast')].forEach(t => t.remove()));
  await page.click('#toolGrid button[data-tool=spot]');
  await page.waitForTimeout(250);
  check('hints stay gone after a reload', !(await toasts()).includes('tap or drag on the video'));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
