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
  await page.waitForTimeout(500);
  /* the startup probe must see the vault even when localStorage is empty — this
     is the iOS-eviction case the vault exists for */
  check('My games still appears when only the vault has the work',
    await page.isVisible('#btnLibrary'));
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await page.waitForTimeout(700);
  check('work comes back from the vault after the quick drawer is cleared',
    await page.evaluate(() => window.__filmroom.getProject().clips.length === 1));

  // ---- a stale quick-drawer copy must not shadow a newer vault copy ----
  // (what a localStorage quota failure leaves behind: old copy in localStorage,
  //  every later save landing only in the vault)
  await page.evaluate(async key => {
    const p = window.__filmroom.getProject();
    const stale = JSON.parse(JSON.stringify(p));
    stale.savedAt = '2020-01-01T00:00:00.000Z';
    const newer = JSON.parse(JSON.stringify(p));
    newer.clips.push({ ...newer.clips[0], id: 'x2', title: 'Saved after the quota filled' });
    newer.savedAt = new Date(Date.now() + 60000).toISOString();
    localStorage.setItem(key, JSON.stringify(stale));
    await new Promise(res => {
      const r = indexedDB.open('filmroom-fs', 1);
      r.onsuccess = () => {
        const t = r.result.transaction('kv', 'readwrite').objectStore('kv')
          .put(JSON.stringify(newer), 'vault:' + key);
        t.onsuccess = res; t.onerror = res;
      };
      r.onerror = res;
    });
  }, fp.key);
  await page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await page.waitForTimeout(900);
  check('the newer vault copy wins over a stale quick-drawer copy',
    await page.evaluate(() => window.__filmroom.getProject().clips.length === 2));

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

  // ---- the old key's entries moved with the work: no duplicate, no stale fork ----
  const gameSize = require('fs').statSync(path.resolve(FIXTURES, 'game.webm')).size;
  const retired = await two.page.evaluate(async oldKey => {
    const inLs = !!localStorage.getItem(oldKey);
    const inVault = await new Promise(res => {
      const r = indexedDB.open('filmroom-fs', 1);
      r.onsuccess = () => {
        const t = r.result.transaction('kv').objectStore('kv').get('vault:' + oldKey);
        t.onsuccess = () => res(!!t.result); t.onerror = () => res(false);
      };
      r.onerror = () => res(false);
    });
    return { inLs, inVault };
  }, 'filmroom:game.webm:' + gameSize);
  check('the old key is gone from the quick drawer', !retired.inLs);
  check('the old key is gone from the vault', !retired.inVault);

  // ---- a genuinely different video must NOT be adopted ----
  await two.page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'ball.webm'));
  await two.page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await two.page.waitForTimeout(900);
  check('a different game starts empty, not adopted',
    await two.page.evaluate(() => window.__filmroom.getProject().clips.length === 0));

  // ---- pagehide flushes the debounced save (iOS often skips beforeunload) ----
  // one evaluate: mutate, fire pagehide, read back — all inside the 600ms debounce
  const flushed = await two.page.evaluate(() => {
    const key = window.__filmroom.getProject().videoKey;
    document.querySelector('#pauseQInput').value = 'Where is the space?';
    document.querySelector('#btnAddPause').click();
    window.dispatchEvent(new Event('pagehide'));
    const p = JSON.parse(localStorage.getItem(key) || '{}');
    return (p.annotations || []).length;
  });
  check('pagehide flushes the last change before the debounce fires (' + flushed + ')',
    flushed === 1);
  await two.browser.close();

  // ---- the length-only match asks first, and saying yes truly brings it back ----
  const three = await launch();
  await three.page.addInitScript(NO_FS);
  await three.page.goto(APP);
  await three.page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  // seed a vault-only candidate: same length as game.webm, different size/name
  await three.page.evaluate(async dur => {
    const cand = { version: 1, videoName: 'oldgame.mov', videoKey: 'filmroom:oldgame.mov:12345',
      fps: 30, videoSize: 12345, videoDuration: dur, reelTitle: 'Week 3',
      savedAt: new Date().toISOString(),
      annotations: [],
      clips: [{ id: 'c1', tIn: 1, tOut: 3, title: 'From the old name', rating: 'positive',
        tags: [], notes: '', position: 'Winger', format: '9v9' }] };
    localStorage.setItem(cand.videoKey, JSON.stringify(cand));
    await new Promise(res => {
      const r = indexedDB.open('filmroom-fs', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => {
        const t = r.result.transaction('kv', 'readwrite').objectStore('kv')
          .put(JSON.stringify(cand), 'vault:' + cand.videoKey);
        t.onsuccess = res; t.onerror = res;
      };
      r.onerror = res;
    });
  }, fp.dur);
  await three.page.reload();
  await three.page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await three.page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await three.page.waitForTimeout(900);
  const offerText = await three.page.evaluate(() =>
    [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));
  check('a same-length match is offered as a question', /same length/.test(offerText));
  check('nothing was adopted before the answer',
    await three.page.evaluate(() => window.__filmroom.getProject().clips.length === 0));
  await three.page.click('.toastBtn');
  await three.page.waitForTimeout(400);
  const adopted = await three.page.evaluate(async () => {
    const p = window.__filmroom.getProject();
    const oldGone = !localStorage.getItem('filmroom:oldgame.mov:12345');
    return { clips: p.clips.length, size: p.videoSize, reel: document.querySelector('#reelTitle').value,
      listed: document.querySelector('#clipList').textContent.includes('From the old name'),
      oldGone };
  });
  check('saying yes brings the clips back', adopted.clips === 1);
  check('the clip list actually shows them', adopted.listed);
  check('the reel title came along', adopted.reel === 'Week 3');
  check('the fingerprint now describes the new file (' + adopted.size + ')', adopted.size > 12345);
  check('the old key moved with the work', adopted.oldGone);

  // ---- a stale offer must not adopt onto a different video ----
  await three.page.evaluate(async dur => {
    const cand = { version: 1, videoName: 'other.mov', videoKey: 'filmroom:other.mov:777',
      fps: 30, videoSize: 777, videoDuration: dur, savedAt: new Date().toISOString(),
      annotations: [], clips: [{ id: 'z1', tIn: 0, tOut: 2, title: 'Stale', rating: 'positive',
        tags: [], notes: '', position: 'Winger', format: '9v9' }] };
    localStorage.setItem(cand.videoKey, JSON.stringify(cand));
  }, fp.dur + 0.1);
  await three.page.reload();
  await three.page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'game.webm'));
  await three.page.waitForFunction(() => document.querySelector('#video').duration > 0);
  await three.page.waitForTimeout(900);
  // the offer toast is up for game.webm — now switch to a different video and answer it
  await three.page.setInputFiles('#fileVideo', path.resolve(FIXTURES, 'ball.webm'));
  await three.page.waitForFunction(() => document.querySelector('#video').duration < 9);
  await three.page.waitForTimeout(700);
  const staleBtn = await three.page.$('.toastBtn');
  if (staleBtn) await staleBtn.click();
  await three.page.waitForTimeout(300);
  const afterStale = await three.page.evaluate(() => {
    const p = window.__filmroom.getProject();
    return { clips: p.clips.length, name: p.videoName };
  });
  check('a stale offer never adopts onto the video opened after it',
    afterStale.clips === 0 && afterStale.name === 'ball.webm');
  await three.browser.close();
  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
