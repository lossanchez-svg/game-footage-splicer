/* Fresh-eyes walkthrough: drives the app exactly the way a first-time user
   would, screenshotting every step into tests/out/walk_*.png. Not a pass/fail
   suite — it's the evidence for "could Grandma figure this out with nobody in
   the room?", and it fails loudly if any step can't be reached. */
const path = require('path');
const { APP, FIXTURES, OUT, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');
let n = 0;
const shot = async (page, name) =>
  page.screenshot({ path: path.join(OUT, 'walk_' + String(++n).padStart(2, '0') + '_' + name + '.png') });

(async () => {
  const { browser, page, errors, check } = await launch();
  await page.setViewportSize({ width: 1280, height: 860 });

  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 1. cold open — the walkthrough points at the one button that matters
  await page.waitForSelector('#tourBubble', { state: 'visible', timeout: 3000 });
  await shot(page, 'first_run');
  check('step 1 asks for a video', (await page.textContent('#tourMsg')).includes('game video'));

  // 2. open a game
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);
  await page.waitForTimeout(300);
  await shot(page, 'video_open');
  check('step 2 asks them to press play', (await page.textContent('#tourStep')).includes('2 of 5'));

  // 3. press play
  await page.click('#btnPlay');
  await page.waitForTimeout(400);
  await page.evaluate(() => document.querySelector('#video').pause());
  await shot(page, 'playing');

  // 4. spotlight the player
  await page.click('#toolGrid button[data-tool=spot]');
  await page.fill('#labelInput', 'Marco');
  const box = await (await page.$('#overlay')).boundingBox();
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(400);
  await shot(page, 'spotlight');
  check('step 4 is about keeping the moment', (await page.textContent('#tourStep')).includes('4 of 5'));

  // 5. mark and save a clip
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 4; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkOut');
  await shot(page, 'marked');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Scanned, then played forward');
  await page.click('#ratingRow [data-rating=positive]');
  await page.fill('#clipNotes', 'He checks his shoulder before the ball arrives — that is why the pass is on.');
  await page.fill('#clipAsk', 'What did he do before the ball got to him?');
  await shot(page, 'save_clip_dialog');
  await page.click('#clipSave');
  await page.waitForTimeout(300);

  // 6. the library, and the tour finishing
  await page.click('#tabs button[data-tab=clips]');
  await page.waitForTimeout(400);
  await shot(page, 'clips_tab');
  check('the tour finishes on the Clips tab',
    await page.evaluate(() => localStorage.getItem('filmroom:tourDone') === '1'));

  // 7. a tooltip, the way someone hunting for a control sees it
  await page.click('#tabs button[data-tab=draw]');
  await page.hover('#selTrack').catch(() => {});
  await page.hover('#toolGrid button[data-tool=spot]');
  await page.waitForTimeout(600);
  await shot(page, 'tooltip');

  // 8. line the week up -> the front door appears
  await page.click('#tabs button[data-tab=clips]');
  await page.fill('#reelTitle', 'Week 3 — seeing it early');
  await page.click('#clipList [data-act=reel]');
  await page.waitForTimeout(400);
  await shot(page, 'watch_banner');
  check('the front door offers the session', await page.evaluate(() =>
    document.querySelector('#watchBanner').style.display === 'flex'));

  // 9. the session, as the family sees it
  await page.click('#watchStart');
  await page.waitForSelector('#sessionModal.open');
  await shot(page, 'session_intro');
  await page.click('#sessionBox [data-s=begin]');
  await page.waitForTimeout(250);
  await shot(page, 'session_question');
  check('his question comes before the clip',
    (await page.textContent('.sessQ')).includes('before the ball got to him'));
  await page.click('#sessionBox [data-s=end]');
  await page.waitForTimeout(300);

  // 10. comfort mode
  await page.click('#btnTextSize');
  await page.waitForTimeout(400);
  await shot(page, 'large_text');
  check('large text is on', await page.evaluate(() => document.body.classList.contains('bigText')));
  await page.click('#btnTextSize');

  // 11. deleting is cheap
  await page.click('#clipList [data-act=del]');
  await page.waitForTimeout(250);
  await shot(page, 'undo_toast');
  check('the delete offers a way back', await page.$('.toast .toastBtn') !== null);
  await page.click('.toast .toastBtn');
  await page.waitForTimeout(300);

  // 12. the reel studio, where the season becomes a recruiting reel
  await page.evaluate(() => [...document.querySelectorAll('.toast')].forEach(t => t.remove()));
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.waitForTimeout(400);
  await page.click('#studioDraft').catch(() => {});   // draft if the pool has anything
  await page.waitForTimeout(400);
  await shot(page, 'reel_studio');
  check('the studio explains itself before anything is planned',
    /season/i.test(await page.textContent('#studioIntro')));
  check('one quiet line of coaching, not a wall of text',
    (await page.textContent('#studioCoachHint')).length < 120);
  await page.click('#studioClose');

  console.log('\nscreenshots written to ' + OUT + '/walk_*.png');
  console.log('--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
