/* Phone-first (v8): the iPhone as the primary device. No folder API, so the
   work itself has to survive — a durable vault behind localStorage, a games
   list built from that work, and a game that is recognised again when the
   Photos picker hands it back under a different name. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

let errors = 0;
const check = (name, ok) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) errors++; };

/* every page in this suite loads as a phone would: no showDirectoryPicker */
const NO_FS = `Object.defineProperty(window, 'showDirectoryPicker', { value: undefined });`;

(async () => {
  const { browser, page, errors: pageErrors } = await launch();
  await page.addInitScript(NO_FS);
  await page.goto(APP);
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();

  check('the folder API really is absent for this run', await page.evaluate(
    () => typeof window.showDirectoryPicker !== 'function'));

  // ---- the games button stays hidden until there is work to come back to ----
  check('no games button on a first-ever visit', !(await page.isVisible('#btnLibrary')));

  // ---- open a game from "Photos" and save a clip ----
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await page.evaluate(() => document.querySelector('#video').currentTime = 1);
  await page.waitForTimeout(250);
  await page.keyboard.press('i');
  await page.evaluate(() => document.querySelector('#video').currentTime = 3);
  await page.waitForTimeout(250);
  await page.keyboard.press('o');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.fill('#clipTitle', 'Scanned before the turn');
  await page.click('[data-rating=positive]');
  await page.click('#clipSave');
  await page.waitForTimeout(900);          // let the debounced save land

  // ---- the fingerprint that makes re-linking possible ----
  const fp = await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    return { size: p.videoSize, dur: p.videoDuration, key: p.videoKey };
  });
  check('the game records its size (' + fp.size + ')', fp.size > 0);
  check('the game records its length (' + (fp.dur || 0).toFixed(2) + 's)', fp.dur > 0);

  // ---- the work is mirrored into the vault, not only localStorage ----
  const vaulted = await page.evaluate(async key => {
    const raw = await new Promise(res => {
      const r = indexedDB.open('filmroom-fs', 1);
      r.onsuccess = () => {
        const t = r.result.transaction('kv').objectStore('kv').get('vault:' + key);
        t.onsuccess = () => res(t.result); t.onerror = () => res(null);
      };
      r.onerror = () => res(null);
    });
    return raw ? JSON.parse(raw).clips.length : -1;
  }, fp.key);
  check('the clip is in the durable vault too (' + vaulted + ')', vaulted === 1);

  // ---- the games button appears once there is work ----
  await page.reload();
  await page.waitForTimeout(500);
  check('the games button appears once a game has work', await page.isVisible('#btnLibrary'));
  await page.click('#btnLibrary');
  await page.waitForTimeout(300);
  check('it opens the list of games worked on, not a folder chooser',
    !(await page.isVisible('#libChoose')));
  check('the list names the game', (await page.textContent('#libList')).includes('game.webm'));
  check('the list shows what is in it', /1 clip/.test(await page.textContent('#libList')));

  // ---- surviving a localStorage clear-out (what iOS does to idle sites) ----
  await page.evaluate(() => {
    for (let i = localStorage.length - 1; i >= 0; i--){
      const k = localStorage.key(i);
      if (k && k.startsWith('filmroom:') && k !== 'filmroom:tourDone') localStorage.removeItem(k);
    }
  });
  await page.reload();
  await page.waitForTimeout(400);
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await page.waitForTimeout(700);
  check('work comes back from the vault after the quick drawer is cleared',
    await page.evaluate(() => window.__filmroom.getProject().clips.length === 1));

  // ---- the same game handed back under a different name still re-links ----
  const two = await launch();
  await two.page.addInitScript(NO_FS);
  await two.page.goto(APP);
  await two.page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await two.page.reload();
  await two.page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await two.page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await two.page.evaluate(() => document.querySelector('#video').currentTime = 2);
  await two.page.waitForTimeout(250);
  await two.page.keyboard.press('i');
  await two.page.evaluate(() => document.querySelector('#video').currentTime = 4);
  await two.page.waitForTimeout(250);
  await two.page.keyboard.press('o');
  await two.page.keyboard.press('Enter');
  await two.page.waitForTimeout(200);
  await two.page.fill('#clipTitle', 'Third-man run');
  await two.page.click('[data-rating=positive]');
  await two.page.click('#clipSave');
  await two.page.waitForTimeout(900);

  /* Photos hands the very same video back as "video.mp4" — a different name, so
     a different key. The length and size still match, so the work should follow. */
  await two.page.setInputFiles('#fileVideo', {
    name: 'video.mp4',
    mimeType: 'video/webm',
    buffer: require('fs').readFileSync(path.resolve(FIXTURES, 'game.webm')),
  });
  await two.page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await two.page.waitForTimeout(900);
  const relinked = await two.page.evaluate(() => {
    const p = window.__filmroom.getProject();
    return { clips: p.clips.length, name: p.videoName, title: (p.clips[0] || {}).title };
  });
  check('a renamed pick re-links to the same game (' + relinked.clips + ' clip)',
    relinked.clips === 1 && relinked.title === 'Third-man run');
  check('and it now belongs to the new file name', relinked.name === 'video.mp4');

  // ---- a genuinely different video must NOT be adopted ----
  await two.page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'ball.webm'));
  await two.page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await two.page.waitForTimeout(900);
  check('a different game starts empty, not adopted',
    await two.page.evaluate(() => window.__filmroom.getProject().clips.length === 0));

  await two.browser.close();
  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
