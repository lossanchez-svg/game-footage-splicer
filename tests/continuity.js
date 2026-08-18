/*
  Cross-device continuity: when the Games folder can be written to, a game's
  work is saved next to its video as "<video>.filmroom.json", and opening the
  same game somewhere else picks it up. Stubs the File System Access API with
  a writable in-memory folder that survives reloads, so "another device" is
  simulated by a browser with an empty localStorage looking at the same folder.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, launch } = require('./common');

const ballB64 = fs.readFileSync(path.join(FIXTURES, 'ball.webm')).toString('base64');

async function fresh(browser, { seed = {}, writable = true } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript(
    ({ b64, seedJson, canWrite }) => {
      /* inlined so it runs before the app script */
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const files = new Map(Object.entries(JSON.parse(seedJson)));
      window.__folder = files;
      window.__writeCount = 0;
      const writableFn = () => canWrite;
      const mkVideo = (name, mtime) =>
        new File([bytes], name, { type: 'video/webm', lastModified: mtime });
      const VIDEOS = [['week1.webm', 1000], ['week2.webm', 2000]];
      const fileHandle = name => ({
        kind: 'file', name,
        getFile: async () => new File([files.get(name) || ''], name, { type: 'application/json' }),
        createWritable: async () => {
          if (!writableFn()) throw new Error('not allowed');
          let buf = '';
          return {
            write: async chunk => { buf += chunk; },
            close: async () => { files.set(name, buf); window.__writeCount++; },
          };
        },
      });
      const dir = {
        kind: 'directory', name: 'Game Film',
        queryPermission: async ({ mode } = {}) =>
          (mode === 'readwrite' && !writableFn()) ? 'prompt' : 'granted',
        requestPermission: async ({ mode } = {}) =>
          (mode === 'readwrite' && !writableFn()) ? 'denied' : 'granted',
        getFileHandle: async (name, opts) => {
          if (!files.has(name) && !(opts && opts.create)) throw new Error('NotFound');
          return fileHandle(name);
        },
        values: async function*(){
          for (const [name, mtime] of VIDEOS)
            yield { kind: 'file', name, getFile: async () => mkVideo(name, mtime) };
          for (const name of [...files.keys()])
            yield { kind: 'file', name, getFile: async () => new File([files.get(name)], name) };
        },
      };
      window.showDirectoryPicker = async () => dir;
    },
    { b64: ballB64, seedJson: JSON.stringify(seed), canWrite: writable });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('CONSOLE: ' + m.text()); });
  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  return { ctx, page, pageErrors };
}

const openGame = async (page, name) => {
  await page.click('#bigLibrary').catch(async () => page.click('#btnLibrary'));
  await page.waitForSelector('#libModal.open');
  await page.click('#libChoose');
  await page.waitForTimeout(300);
  await page.click(`#libList .annItem:has-text("${name}")`);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 1);
  await page.waitForTimeout(200);
};

const saveAClip = async (page, title, at) => {
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at);
  await page.waitForTimeout(140);
  await page.click('#btnMarkIn');
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at + 2);
  await page.waitForTimeout(140);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', title);
  await page.click('#clipSave');
  await page.waitForTimeout(250);
};

const folderFiles = page => page.evaluate(() => [...window.__folder.keys()]);
const folderJson = (page, name) =>
  page.evaluate(n => JSON.parse(window.__folder.get(n) || 'null'), name);

(async () => {
  const { browser, errors, check } = await launch();

  // ================= device 1: does the work =================
  const one = await fresh(browser);
  await openGame(one.page, 'week2.webm');

  check('opening from the folder turns continuity on',
    await one.page.isVisible('#continuity'));
  check('and says so in plain words',
    /Games folder/i.test(await one.page.textContent('#continuity')));
  check('the first time, it explains what that means', await one.page.evaluate(() =>
    [...document.querySelectorAll('.toast')].some(t => /follows you to your other devices/i.test(t.textContent))));

  await saveAClip(one.page, 'Great scan', 1);
  await one.page.waitForTimeout(3000);           // folder writes are debounced ~2.5s

  const files = await folderFiles(one.page);
  check('the project is written next to its video (' + files.join(', ') + ')',
    files.includes('week2.webm.filmroom.json'));
  let saved = await folderJson(one.page, 'week2.webm.filmroom.json');
  check('the folder copy holds the clip',
    saved && saved.clips.length === 1 && saved.clips[0].title === 'Great scan');
  check('and is stamped with when it was saved', !!saved.savedAt);

  // more edits keep the folder copy current, without a write per keystroke
  const before = await one.page.evaluate(() => window.__writeCount);
  await saveAClip(one.page, 'Heavy touch', 4);
  await one.page.waitForTimeout(3000);
  saved = await folderJson(one.page, 'week2.webm.filmroom.json');
  const after = await one.page.evaluate(() => window.__writeCount);
  check('later edits reach the folder too (' + saved.clips.length + ' clips)', saved.clips.length === 2);
  check(`writes are batched, not one per change (${after - before} for one clip)`, after - before <= 2);

  const snapshot = await one.page.evaluate(() => Object.fromEntries(window.__folder));
  await one.ctx.close();

  // ================= device 2: same folder, empty browser =================
  const two = await fresh(browser, { seed: snapshot });
  const listed = await (async () => {
    await two.page.click('#bigLibrary');
    await two.page.waitForSelector('#libModal.open');
    await two.page.click('#libChoose');
    await two.page.waitForTimeout(300);
    return two.page.textContent('#libList');
  })();
  check('the list flags a game with work from elsewhere',
    /has work from another device/i.test(listed));
  check('and does not claim it was worked on here',
    !/📝 has work/.test(listed));

  await two.page.click('#libList .annItem:has-text("week2.webm")');
  await two.page.waitForSelector('#videoWrap', { state: 'visible' });
  await two.page.waitForTimeout(400);
  const clips2 = await two.page.evaluate(() => window.__filmroom.getProject().clips.map(c => c.title));
  check('the other device picks the work up automatically (' + clips2.join(', ') + ')',
    clips2.length === 2 && clips2.includes('Great scan'));
  check('and says where it came from', await two.page.evaluate(() =>
    [...document.querySelectorAll('.toast')].some(t => /from your Games folder/i.test(t.textContent))));

  // an untouched game is still a clean slate
  await two.page.click('#btnLibrary');
  await two.page.waitForTimeout(200);
  await two.page.click('#libList .annItem:has-text("week1.webm")');
  await two.page.waitForTimeout(500);
  check('a game nobody has touched still opens empty',
    await two.page.evaluate(() => window.__filmroom.getProject().clips.length === 0));
  await two.ctx.close();

  // ================= newest wins =================
  // The folder holds yesterday's copy; this browser has a newer one. The newer
  // one must win — otherwise reopening a game would silently undo today's work.
  // (Read-only here so the folder copy stays stale while this browser moves on.)
  const stale = JSON.parse(JSON.stringify(snapshot));
  const key = 'week2.webm.filmroom.json';
  const old = JSON.parse(stale[key]);
  old.savedAt = new Date(Date.parse(old.savedAt) - 86400000).toISOString();
  old.clips = [old.clips[0]];
  stale[key] = JSON.stringify(old);

  const three = await fresh(browser, { seed: stale, writable: false });
  await openGame(three.page, 'week2.webm');
  check('with nothing saved here, yesterday\u2019s folder copy is used',
    await three.page.evaluate(() => window.__filmroom.getProject().clips.length === 1));

  await saveAClip(three.page, 'Saved here just now', 4);
  await three.page.waitForTimeout(300);
  await three.page.reload();
  await three.page.evaluate(() =>
    [...document.querySelectorAll('.toast')].forEach(t => t.remove()));
  await three.page.click('#btnLibrary');
  await three.page.waitForSelector('#libModal.open');
  await three.page.click('#libChoose');
  await three.page.waitForTimeout(300);
  await three.page.click('#libList .annItem:has-text("week2.webm")');
  await three.page.waitForSelector('#videoWrap', { state: 'visible' });
  await three.page.waitForTimeout(400);

  const titles = await three.page.evaluate(() =>
    window.__filmroom.getProject().clips.map(c => c.title));
  check('the newer local copy wins over the older folder one (' + titles.length +
    ' clips: ' + titles.join(', ') + ')',
    titles.length === 2 && titles.includes('Saved here just now'));
  check('and it says so as "where you left off", not "from your Games folder"',
    await three.page.evaluate(() => {
      const t = [...document.querySelectorAll('.toast')].map(x => x.textContent).join(' | ');
      return /where you left off/i.test(t) && !/from your Games folder/i.test(t);
    }));
  await three.ctx.close();

  // ================= read-only folder: silent fallback =================
  const ro = await fresh(browser, { writable: false });
  await openGame(ro.page, 'week2.webm');
  check('a folder it cannot write to shows no continuity promise',
    !(await ro.page.isVisible('#continuity')));
  await saveAClip(ro.page, 'Local only', 1);
  await ro.page.waitForTimeout(3000);
  check('nothing is written there', (await folderFiles(ro.page)).length === 0);
  check('but the work is still saved in this browser', await ro.page.evaluate(() =>
    JSON.parse(localStorage.getItem('filmroom:week2.webm:' +
      window.__filmroom.getProject().videoKey.split(':').pop()) || 'null') !== null ||
    window.__filmroom.getProject().clips.length === 1));
  check('and no error reached the console' +
    (ro.pageErrors.length ? ' — ' + ro.pageErrors.join(' | ') : ''), ro.pageErrors.length === 0);
  await ro.ctx.close();

  // ================= a video opened outside the folder is unaffected =================
  const plain = await fresh(browser);
  await plain.page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await plain.page.waitForSelector('#videoWrap', { state: 'visible' });
  await plain.page.waitForTimeout(300);
  check('a video opened the ordinary way promises nothing',
    !(await plain.page.isVisible('#continuity')));
  await saveAClip(plain.page, 'Dragged in', 1);
  await plain.page.waitForTimeout(3000);
  check('and writes nothing into the folder', (await folderFiles(plain.page)).length === 0);
  await plain.ctx.close();

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
