/*
  Side-by-side compare suite: two clips in lockstep (A is the master clock,
  B re-synced each frame), pair-looping over A's range, frame-stepping both,
  align nudge, an outside file as the model side, and a composite PNG.
*/
const path = require('path');
const { APP, FIXTURES, launch, openDisclosures } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  async function makeClip(tIn, tOut, title){
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, tIn);
    await page.waitForTimeout(200);
    await page.click('#btnMarkIn');
    await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, tOut);
    await page.waitForTimeout(200);
    await page.click('#btnMarkOut');
    await page.click('#btnSaveClip');
    await page.waitForSelector('#clipModal.open');
    await page.fill('#clipTitle', title);
    await page.click('#clipSave');
    await page.waitForTimeout(200);
  }
  await makeClip(1, 3, 'His touch');
  await makeClip(5, 7, 'Model touch');

  // open compare from the first clip's button
  await openDisclosures(page);
  await page.click('#clipList .clipItem >> nth=0 >> [data-act=compare]');
  await page.waitForSelector('#compareWrap', { state: 'visible' });
  check('compare opens, video hidden', !(await page.isVisible('#videoWrap')));
  check('labels set', (await page.textContent('#cmpLabelA')).includes('His touch') &&
                      (await page.textContent('#cmpLabelB')).includes('Model touch'));

  const t = () => page.evaluate(() => ({
    a: document.querySelector('#videoA').currentTime,
    b: document.querySelector('#videoB').currentTime,
    ap: document.querySelector('#videoA').paused,
    bp: document.querySelector('#videoB').paused,
  }));

  await page.waitForTimeout(500);
  let s = await t();
  check(`start positions (A=${s.a.toFixed(2)}≈1, B=${s.b.toFixed(2)}≈5)`,
    Math.abs(s.a - 1) < 0.15 && Math.abs(s.b - 5) < 0.15);

  // play both in sync
  await page.click('#cmpPlay');
  await page.waitForTimeout(800);
  s = await t();
  check('both playing', !s.ap && !s.bp);
  check(`in sync (drift ${(s.b - 5 - (s.a - 1)).toFixed(3)}s)`, Math.abs((s.b - 5) - (s.a - 1)) < 0.15);

  // pair loops over A's 2s range
  await page.waitForFunction(() => {
    const a = document.querySelector('#videoA');
    return a.currentTime < 1.8 && a.currentTime >= 1;
  }, { timeout: 10000 }).then(() => check('pair loops over the clip range', true))
    .catch(() => check('pair loops over the clip range', false));

  // pause + frame step both
  await page.click('#cmpPlay');
  s = await t();
  const before = s;
  await page.click('#cmpStepFwd');
  await page.waitForTimeout(200);
  s = await t();
  check(`frame step advances both (ΔA=${(s.a - before.a).toFixed(3)}, ΔB=${(s.b - before.b).toFixed(3)})`,
    s.a > before.a && s.b > before.b && s.ap && s.bp);

  // align nudge shifts B
  const bBefore = s.b;
  await page.click('#cmpOffPlus');
  await page.click('#cmpOffPlus');
  await page.waitForTimeout(200);
  s = await t();
  check(`align +0.2 shifts B (${(s.b - bBefore).toFixed(2)}s)`, Math.abs(s.b - bBefore - 0.2) < 0.1);
  check('offset shown', (await page.textContent('#cmpOff')) === '+0.2s');

  // composite PNG
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('#btnSnapshot'),
  ]);
  check('composite PNG downloads', dl.suggestedFilename().endsWith('.png'));

  // outside file as the model side
  await Promise.all([
    page.waitForEvent('filechooser').then(fc => fc.setFiles(path.join(FIXTURES, 'ball.webm'))),
    page.click('#cmpFileBtn'),
  ]);
  await page.waitForTimeout(600);
  check('file becomes model side', (await page.textContent('#cmpLabelB')).includes('ball.webm'));
  s = await t();
  check(`file B starts at 0 (${s.b.toFixed(2)})`, s.b < 0.2);

  // close restores the editor
  await page.click('#cmpClose');
  check('closing restores video', await page.isVisible('#videoWrap'));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
