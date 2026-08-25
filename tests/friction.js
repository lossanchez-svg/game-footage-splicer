/* The friction backlog from real use: nothing fails silently, deleting is
   always take-back-able, and an expensive export says how expensive. */
const path = require('path');
const { APP, FIXTURES, launch, openDisclosures } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');
const toasts = page => page.evaluate(() =>
  [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const clearToasts = page => page.evaluate(() =>
  [...document.querySelectorAll('.toast')].forEach(t => t.remove()));

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  // ---- with no video open, the controls explain themselves ----
  await page.click('#btnPlay');
  await page.waitForTimeout(150);
  check('play with nothing open says so', /no game open yet/i.test(await toasts(page)));
  check('and it names the button that fixes it', /Open a video/i.test(await toasts(page)));
  check('and points at that button', await page.evaluate(() =>
    document.querySelector('#bigOpen').classList.contains('pointAt')));
  await clearToasts(page);

  for (const [sel, what] of [['#btnFrameFwd', 'frame step'], ['#btnFwd5', '5s jump'],
                             ['#btnMarkIn', 'start clip'], ['#btnSaveClip', 'save clip'],
                             ['#btnExport', 'save video'], ['#btnSnapshot', 'photo'],
                             ['#btnSaveProj', 'save project']]) {
    await clearToasts(page);
    await openDisclosures(page);   // #btnSaveProj sits inside the Project menu now
    await page.click(sel);
    await page.waitForTimeout(120);
    check(`${what} with nothing open explains itself`, /no game open yet/i.test(await toasts(page)));
  }
  await clearToasts(page);

  // ---- Safari on a Mac has no folder library; the empty state says why ----
  check('the empty state covers the missing Games button on Safari',
    /Chrome or Edge/i.test(await page.textContent('#dropHint')));

  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  // ---- deleting is never a dead end ----
  let dialogs = 0;
  page.on('dialog', d => { dialogs++; d.dismiss(); });

  await page.click('#toolGrid button[data-tool=spot]');
  const box = await (await page.$('#overlay')).boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(200);
  check('a drawing exists', (await page.textContent('#annCount')).includes('1'));

  await clearToasts(page);
  await page.click('#annList .annItem [data-act=del]');
  await page.waitForTimeout(200);
  check('deleting a drawing asks nothing', dialogs === 0);
  check('the drawing is gone', !(await page.textContent('#annCount')).includes('1'));
  check('the message offers Undo', /deleted/i.test(await toasts(page)));
  await page.click('.toast .toastBtn');
  await page.waitForTimeout(250);
  check('Undo brings the drawing back', (await page.textContent('#annCount')).includes('1'));

  // save two clips
  for (const [a, b, title] of [[1, 3, 'Great scan'], [4, 6, 'Heavy touch']]) {
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, a);
    await page.waitForTimeout(140);
    await page.click('#btnMarkIn');
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, b);
    await page.waitForTimeout(140);
    await page.click('#btnMarkOut');
    await page.click('#btnSaveClip');
    await page.waitForSelector('#clipModal.open');
    await page.fill('#clipTitle', title);
    await page.click('#clipSave');
    await page.waitForTimeout(200);
  }

  await page.click('#tabs button[data-tab=clips]');
  await clearToasts(page);
  await openDisclosures(page);
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=del]');
  await page.waitForTimeout(200);
  check('deleting a clip asks nothing either', dialogs === 0);
  check('the clip is gone', !(await page.textContent('#clipList')).includes('Great scan'));
  check('the message names the clip it deleted', /Great scan/.test(await toasts(page)));
  await page.click('.toast .toastBtn');
  await page.waitForTimeout(250);
  check('Undo brings the clip back', (await page.textContent('#clipList')).includes('Great scan'));

  // undo still targets the right deletion after later edits
  await clearToasts(page);
  await openDisclosures(page);
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=del]');
  await page.waitForTimeout(150);
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=reel]');   // an unrelated edit
  await page.waitForTimeout(150);
  await page.click('.toast .toastBtn');
  await page.waitForTimeout(250);
  const after = await page.textContent('#clipList');
  check('Undo restores that exact deletion, not merely the last change',
    after.includes('Great scan') && after.includes('Heavy touch'));

  // clearing this week's list is undoable too
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=reel]');
  await page.waitForTimeout(200);
  await clearToasts(page);
  await page.click('#btnClearReel');
  await openDisclosures(page);
  await page.waitForTimeout(200);
  check('clearing the list is undoable', /deleted/i.test(await toasts(page)));
  await page.click('.toast .toastBtn');
  await page.waitForTimeout(250);
  check('the list comes back',
    await page.evaluate(() => (window.__filmroom.getProject().reel || []).length > 0));

  // ---- the whole-game export warns with a real number ----
  let confirmText = '';
  page.removeAllListeners('dialog');
  page.on('dialog', d => { confirmText = d.message(); d.dismiss(); });
  await page.click('#tabs button[data-tab=draw]');
  await page.evaluate(() => { window.__filmroom.getProject(); });
  await page.click('#btnExport');           // no In/Out marked -> whole game
  await page.waitForTimeout(300);
  check('the whole-game export asks first', confirmText.length > 0);
  check('and states how long it is (' + (confirmText.match(/about [^,]+/) || [''])[0] + ')',
    /about \d+ minute/.test(confirmText));
  check('and offers the cheaper alternative', /Start clip here/.test(confirmText));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
