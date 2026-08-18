/*
  Guided-session suite: two clips run as a session — question shown BEFORE each
  clip plays, answers captured, recap saved — then the session log persists
  through reload and exports a notes file.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, OUT, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  async function makeClip(tIn, tOut, title, ask){
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, tIn);
    await page.waitForTimeout(200);
    await page.click('#btnMarkIn');
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, tOut);
    await page.waitForTimeout(200);
    await page.click('#btnMarkOut');
    await page.click('#btnSaveClip');
    await page.waitForSelector('#clipModal.open');
    await page.fill('#clipTitle', title);
    if (ask) await page.fill('#clipAsk', ask);
    await page.click('#ratingRow [data-rating=neutral]');
    await page.click('#clipSave');
    await page.waitForTimeout(200);
  }
  await makeClip(1, 2, 'First moment', 'Where is the space?');
  await makeClip(3, 4, 'Second moment', '');

  // both into the reel, then run the session
  for (let i = 0; i < 2; i++){
    await page.click(`#clipList .clipItem >> nth=${i} >> [data-act=reel]`);
    await page.waitForTimeout(150);
  }
  await page.fill('#reelTitle', 'Tuesday film session');
  await page.click('#btnRunSession');
  await page.waitForSelector('#sessionModal.open');
  check('intro shows title + clip count',
    (await page.textContent('#sessionBox')).includes('Tuesday film session') &&
    (await page.textContent('#sessionBox')).includes('2 clips'));

  await page.click('#sessionBox [data-s=begin]');
  const askText = await page.textContent('#sessionBox');
  check('question shown BEFORE the clip plays', askText.includes('Where is the space?'));
  check('custom question used for clip 1', askText.includes('First moment'));

  await page.click('#sessionBox [data-s=play]');
  await page.waitForTimeout(300);
  check('session bar visible during playback', await page.isVisible('#sessionBar'));
  check('video playing clip 1', await page.evaluate(() => !document.querySelector('#video').paused));
  await page.waitForSelector('#sessionModal.open', { timeout: 10000 });   // clip is 1s
  check('auto-paused into answer screen', await page.isVisible('#sessAnswer'));
  await page.fill('#sessAnswer', 'Pass it wide to the winger');
  await page.click('#sessionBox [data-s=next]');

  const ask2 = await page.textContent('#sessionBox');
  check('clip 2 uses default question', ask2.includes('What do you see?'));
  await page.click('#sessionBox [data-s=play]');
  await page.waitForSelector('#sessionModal.open', { timeout: 10000 });
  await page.click('#sessionBox [data-s=next]');

  check('recap screen reached', (await page.textContent('#sessionBox')).includes('Finish strong'));
  await page.fill('#sessWell1', 'Scanned before receiving');
  await page.fill('#sessWell2', 'Good energy pressing');
  await page.fill('#sessWorkOn', 'First touch toward space');
  await page.click('#sessionBox [data-s=finish]');
  await page.waitForTimeout(300);

  check('session modal closed', !(await page.isVisible('#sessionModal .box')));
  const log = await page.textContent('#sessionLog');
  check('session logged', log.includes('Tuesday film session'));
  check('log shows 2 clips / 1 answered', log.includes('2 clips') && log.includes('1 answered'));
  await page.click('#sessionLog details summary');
  const logOpen = await page.textContent('#sessionLog');
  check('answer recorded', logOpen.includes('Pass it wide to the winger'));
  check('recap recorded', logOpen.includes('First touch toward space'));

  // notes file download
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('#sessionLog [data-act=notes]'),
  ]);
  const notesPath = path.join(OUT, dl.suggestedFilename());
  await dl.saveAs(notesPath);
  const notes = fs.readFileSync(notesPath, 'utf8');
  check('notes file has Q&A + recap',
    notes.includes('Q: Where is the space?') &&
    notes.includes('A: Pass it wide to the winger') &&
    notes.includes('Work on this week: First touch toward space'));

  // persistence through reload
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(400);
  check('session log survives reload', (await page.textContent('#sessionLog')).includes('Tuesday film session'));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
