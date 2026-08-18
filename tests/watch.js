/* The "watch" front door: when a game already has a set of clips lined up,
   anyone who opens it gets one obvious button that starts the session. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');
const bannerShown = page => page.evaluate(() =>
  document.querySelector('#watchBanner').style.display === 'flex');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  check('no banner on a game with nothing saved yet', !(await bannerShown(page)));

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
  check('still no banner — clips saved but none lined up to watch', !(await bannerShown(page)));

  await page.click('#tabs button[data-tab=clips]');
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=reel]');
  await page.waitForTimeout(250);
  check('the banner appears as soon as a clip is lined up', await bannerShown(page));

  await page.fill('#reelTitle', 'Week 3 — playing between the lines');
  await page.click('#clipList .clipItem >> nth=1 >> [data-act=reel]');
  await page.waitForTimeout(250);
  const sub = await page.textContent('#watchSub');
  check('it says what is waiting (' + sub.trim() + ')',
    /Week 3/.test(sub) && /2 clips/.test(sub) && /minute/.test(sub));
  check('the banner leads with one plain action',
    (await page.textContent('#watchStart')).trim() === 'Start watching');

  // ---- starting it runs the guided session ----
  await page.click('#watchStart');
  await page.waitForSelector('#sessionModal.open', { timeout: 3000 });
  check('Start watching opens the session', await page.$('#sessionModal.open') !== null);
  check('the banner steps aside while watching', !(await bannerShown(page)));
  check('session type is XL enough to read from the sofa', await page.evaluate(() => {
    const q = document.querySelector('#sessionBox h3');
    const btn = document.querySelector('.sessBtns button');
    return parseFloat(getComputedStyle(q).fontSize) >= 24 &&
           btn.getBoundingClientRect().height >= 48;
  }));

  await page.click('#sessionBox [data-s=begin]');
  await page.waitForTimeout(200);
  check('the question is set in extra-large type', await page.evaluate(() =>
    parseFloat(getComputedStyle(document.querySelector('.sessQ')).fontSize) >= 26));
  await page.click('#sessionBox [data-s=end]');
  await page.waitForTimeout(300);
  check('after a finished session it does not nag again this visit', !(await bannerShown(page)));

  // ---- dismissal lasts the visit, and the offer returns next time ----
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(500);
  check('reopening the game offers the session again', await bannerShown(page));

  await page.click('#watchLater');
  await page.waitForTimeout(150);
  check('“Not right now” hides it', !(await bannerShown(page)));
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=reel]');   // remove
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=reel]');   // add back
  await page.waitForTimeout(250);
  check('it stays hidden for the rest of the visit', !(await bannerShown(page)));

  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(500);
  check('and is back the next time the game is opened', await bannerShown(page));

  // ---- an emptied list takes the banner with it ----
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#btnClearReel');
  await page.waitForTimeout(250);
  check('clearing the list removes the banner', !(await bannerShown(page)));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
