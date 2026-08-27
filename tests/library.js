/*
  Game-film library suite: the File System Access flow with a stubbed
  showDirectoryPicker serving real video bytes — choose folder, list games
  (newest first, has-work marker), one-click open, and hidden-when-unsupported.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();

  const ballB64 = fs.readFileSync(path.join(FIXTURES, 'ball.webm')).toString('base64');
  await page.addInitScript(b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const mkFile = (name, mtime) =>
      new File([bytes], name, { type: 'video/webm', lastModified: mtime });
    const dir = {
      kind: 'directory', name: 'Game Film',
      queryPermission: async () => 'granted',
      values: async function*(){
        for (const [name, mtime] of [['week1.webm', 1000], ['week2.webm', 2000], ['notes.txt', 3000]])
          yield { kind: 'file', name, getFile: async () => mkFile(name, mtime) };
      },
    };
    window.showDirectoryPicker = async () => dir;
  }, ballB64);

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); });
  await page.reload();

  check('library button shown when API present', await page.isVisible('#btnLibrary'));
  check('big library button on empty state', await page.isVisible('#bigLibrary'));

  await page.click('#bigLibrary');
  await page.waitForSelector('#libModal.open');
  check('first open shows folder hint', await page.isVisible('#libHint'));

  await page.click('#libChoose');
  await page.waitForTimeout(300);
  const rows = await page.$$eval('#libList .annItem .lbl', els => els.map(e => e.textContent));
  check(`lists only videos, newest first (${rows.join(', ')})`,
    rows.length === 2 && rows[0] === 'week2.webm' && rows[1] === 'week1.webm');

  // one click opens the game
  await page.click('#libList .annItem >> nth=0');
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  check('clicking a game loads it', true);
  check('modal closed on open', !(await page.isVisible('#libModal .box')));

  // save something, reopen the list → has-work marker
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Marker check');
  await page.click('#clipSave');
  await page.waitForTimeout(800);   // let the debounced autosave land
  await page.click('#btnLibrary');
  await page.waitForTimeout(300);
  const marked = await page.textContent('#libList');
  check('opened game shows the has-work marker', marked.includes('week2.webm') && marked.includes('has work'));
  await page.click('#libClose');

  /* Without the API there is no folder to offer — and on a device with no work
     yet the button stays hidden rather than opening an empty drawer. Once the
     device HAS work it becomes the "My games" list instead; tests/phonefirst.js
     covers that half. */
  const page2 = await (await browser.newContext()).newPage();
  await page2.addInitScript(() => { delete window.showDirectoryPicker; });
  await page2.goto(APP);
  check('library hidden when API absent and nothing worked on yet',
    !(await page2.isVisible('#btnLibrary')));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
