/*
  His player card (v5-A): filled in once, reused everywhere.

  What must be true:
  - The card saves from the modal and survives a reload (localStorage).
  - The reel's opening card leads with WHO once the card exists — the words are
    asserted through reelCardLines(), not by reading pixels (the buildFastAudio
    lesson: test the logic that can actually be wrong).
  - Saved reels are named after him: "Name - Grad year - Position - Reel".
  - The photo is stored in IndexedDB (never localStorage — the voice-over
    quota lesson) and is shrunk to card size (≤512px).
  - The card travels with the Games folder as player.filmroom.json: written
    when saved, adopted on another device, newest savedAt wins in both
    directions — the same rule as game sidecars, and adopting says so.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, launch } = require('./common');

const PHOTO = path.resolve(__dirname, '..', 'icon-512.png');
/* a real 1x1 JPEG, for seeding a photo through the folder sidecar */
const DOT_JPEG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

const ballB64 = fs.readFileSync(path.join(FIXTURES, 'ball.webm')).toString('base64');

/* the continuity suite's writable in-memory Games folder, trimmed to what
   this suite needs: one video so the library has something to list, plus
   whatever JSON files the app writes into it */
async function freshWithFolder(browser, { seed = {} } = {}){
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  await page.addInitScript(({ b64, seedJson }) => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const files = new Map(Object.entries(JSON.parse(seedJson)));
    window.__folder = files;
    window.__writeCount = 0;
    const fileHandle = name => ({
      kind: 'file', name,
      getFile: async () => new File([files.get(name) || ''], name, { type: 'application/json' }),
      createWritable: async () => {
        let buf = '';
        return {
          write: async chunk => { buf += chunk; },
          close: async () => { files.set(name, buf); window.__writeCount++; },
        };
      },
    });
    const dir = {
      kind: 'directory', name: 'Game Film',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFileHandle: async (name, opts) => {
        if (!files.has(name) && !(opts && opts.create)) throw new Error('NotFound');
        return fileHandle(name);
      },
      values: async function*(){
        yield { kind: 'file', name: 'week1.webm',
          getFile: async () => new File([bytes], 'week1.webm', { type: 'video/webm', lastModified: 1000 }) };
        for (const name of [...files.keys()])
          yield { kind: 'file', name, getFile: async () => new File([files.get(name)], name) };
      },
    };
    window.showDirectoryPicker = async () => dir;
  }, { b64: ballB64, seedJson: JSON.stringify(seed) });
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('CONSOLE: ' + m.text()); });
  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  return { ctx, page, pageErrors };
}

const connectFolder = async page => {
  await page.click('#btnLibrary').catch(() => page.click('#bigLibrary'));
  await page.waitForSelector('#libModal.open');
  await page.click('#libChoose');
  await page.waitForTimeout(400);          // library render + card sync are async
  await page.click('#libClose');
};

const fillCard = async (page, fields) => {
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#btnProfile');
  await page.waitForSelector('#profileModal.open');
  for (const [sel, val] of Object.entries(fields)) await page.fill(sel, val);
  await page.click('#profSave');
  await page.waitForFunction(() =>
    !document.querySelector('#profileModal').classList.contains('open'));
  await page.waitForTimeout(150);
};

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  /* ---- the empty state says what this is for, in one sentence ---- */
  await page.click('#tabs button[data-tab=clips]');
  check('the empty card explains itself',
    await page.isVisible('#profileHint') &&
    /once/i.test(await page.textContent('#profileHint')));
  check('one obvious action: “Fill in his card”',
    /fill in/i.test(await page.textContent('#btnProfile')));

  /* ---- fill it in, save it ---- */
  await fillCard(page, {
    '#profName': 'Jude Sanchez', '#profJersey': '81', '#profGrad': '2032',
    '#profPositions': 'Attacking Mid, Winger', '#profClub': 'FC Dallas 2032B',
    '#profContact': 'los.sanchez@example.com',
  });
  const summary = await page.textContent('#profileSummary');
  check(`the summary reads like a roster line (${summary.trim().replace(/\s+/g, ' ')})`,
    /Jude Sanchez/.test(summary) && /#81/.test(summary) &&
    /Class of 2032/.test(summary) && /Attacking Mid/.test(summary));
  check('the button now offers editing', /edit/i.test(await page.textContent('#btnProfile')));

  /* ---- it survives a reload, and the modal reopens filled in ---- */
  await page.reload();
  await page.click('#tabs button[data-tab=clips]');
  check('the card survives a reload',
    /Jude Sanchez/.test(await page.textContent('#profileSummary')));
  await page.click('#btnProfile');
  await page.waitForSelector('#profileModal.open');
  check('the modal reopens with his details in it',
    await page.inputValue('#profName') === 'Jude Sanchez' &&
    await page.inputValue('#profJersey') === '81');
  await page.click('#profCancel');

  /* ---- the reel's opening card leads with WHO ---- */
  const lines = await page.evaluate(() =>
    window.__filmroom.playerCard.lines({ title: 'Week 3 — between the lines', count: 5 }));
  check(`the reel card leads with his name (${lines.name})`, lines.name === 'JUDE SANCHEZ');
  check(`and carries the roster line (${lines.sub})`,
    /#81/.test(lines.sub) && /Class of 2032/.test(lines.sub) &&
    /Attacking Mid/.test(lines.sub) && /FC Dallas/.test(lines.sub));
  check('the reel title still appears', lines.title === 'Week 3 — between the lines');

  /* ---- saved reels are named after him ---- */
  const base = await page.evaluate(() => window.__filmroom.playerCard.fileBase('Week 3'));
  check(`the file a coach keeps says whose film it is (${base})`,
    base === 'Jude Sanchez - 2032 - Attacking Mid - Week 3');

  /* ---- without a card, nothing changes ---- */
  const plain = await page.evaluate(() => {
    localStorage.removeItem('filmroom:playerCard');
    return null;
  });
  await page.reload();
  const noCard = await page.evaluate(() => ({
    lines: window.__filmroom.playerCard.lines({ title: 'Highlight Reel', count: 3 }),
    base: window.__filmroom.playerCard.fileBase('Week 3'),
  }));
  check('no card: the reel card is title-led, as before', noCard.lines.name === null &&
    noCard.lines.title === 'Highlight Reel');
  check('no card: file names are untouched (null base)', noCard.base === null);
  void plain;

  /* ---- a card with no name does not save ---- */
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#btnProfile');
  await page.waitForSelector('#profileModal.open');
  await page.fill('#profJersey', '9');
  await page.click('#profSave');
  await page.waitForTimeout(200);
  check('saving without a name explains instead of half-saving',
    await page.evaluate(() => document.querySelector('#profileModal').classList.contains('open')) &&
    (await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' ')))
      .includes('name'));
  await page.click('#profCancel');

  /* ---- the photo: picked, shrunk, kept in IndexedDB, shown after reload ---- */
  await fillCard(page, { '#profName': 'Jude Sanchez', '#profJersey': '81' });
  await page.click('#btnProfile');
  await page.waitForSelector('#profileModal.open');
  await page.setInputFiles('#profPhotoFile', PHOTO);
  await page.waitForTimeout(400);
  check('a picked photo previews at once', await page.isVisible('#profPhotoPrev'));
  check('and can be removed again', await page.isVisible('#profPhotoClear'));
  await page.click('#profSave');
  await page.waitForTimeout(300);
  const photo = await page.evaluate(async () => {
    const blob = await window.__filmroom.playerCard.photo();
    if (!blob) return null;
    const img = await createImageBitmap(blob);
    return { type: blob.type, w: img.width, h: img.height, size: blob.size };
  });
  check(`the photo is stored as a small JPEG (${photo && photo.type}, ${photo && photo.w}x${photo && photo.h}, ${photo && photo.size} bytes)`,
    photo && photo.type === 'image/jpeg' && photo.w <= 512 && photo.h <= 512 && photo.size > 500);
  await page.reload();
  await page.click('#tabs button[data-tab=clips]');
  await page.waitForTimeout(300);
  check('the summary shows his photo after a reload',
    await page.evaluate(() => !!document.querySelector('#profileSummary img')));

  /* ---- localStorage never carries the photo (the quota lesson) ---- */
  check('localStorage holds the card but never the photo',
    await page.evaluate(() => {
      const raw = localStorage.getItem('filmroom:playerCard') || '';
      return raw.includes('Jude') && !raw.includes('data:image');
    }));

  await page.close();

  /* ---- the card travels with the Games folder: written when saved ---- */
  {
    const { ctx, page: p2, pageErrors } = await freshWithFolder(browser);
    await connectFolder(p2);
    await fillCard(p2, { '#profName': 'Jude Sanchez', '#profJersey': '81', '#profGrad': '2032' });
    await p2.waitForTimeout(400);
    const filed = await p2.evaluate(() => {
      const txt = window.__folder.get('player.filmroom.json');
      return txt ? JSON.parse(txt) : null;
    });
    check('saving the card writes player.filmroom.json into the Games folder',
      filed && filed.name === 'Jude Sanchez' && !!filed.savedAt);
    check('no page errors while syncing the card', pageErrors.length === 0);
    await ctx.close();
  }

  /* ---- adopted on "another device", and it says so ---- */
  {
    const seeded = {
      'player.filmroom.json': JSON.stringify({
        name: 'Jude Sanchez', jersey: '81', gradYear: '2032',
        positions: 'Attacking Mid', photo: DOT_JPEG,
        savedAt: new Date(Date.now() + 5000).toISOString(),
      }),
    };
    const { ctx, page: p3 } = await freshWithFolder(browser, { seed: seeded });
    await connectFolder(p3);
    await p3.click('#tabs button[data-tab=clips]');
    await p3.waitForTimeout(300);
    check('a second device picks his card up from the folder',
      /Jude Sanchez/.test(await p3.textContent('#profileSummary')));
    const toasts = await p3.evaluate(() =>
      [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));
    check(`and says where it came from (${toasts.trim().slice(0, 60)}…)`,
      /Games folder/i.test(toasts));
    const gotPhoto = await p3.evaluate(async () => !!(await window.__filmroom.playerCard.photo()));
    check('the photo came along inside the sidecar', gotPhoto);
    await ctx.close();
  }

  /* ---- newest wins the other way: local newer than the folder's copy ---- */
  {
    const seeded = {
      'player.filmroom.json': JSON.stringify({
        name: 'Old Name', savedAt: '2020-01-01T00:00:00.000Z',
      }),
    };
    const { ctx, page: p4 } = await freshWithFolder(browser, { seed: seeded });
    await fillCard(p4, { '#profName': 'Jude Sanchez', '#profJersey': '81' });
    await connectFolder(p4);
    await p4.waitForTimeout(400);
    check('a newer local card is kept, not overwritten by the folder',
      /Jude Sanchez/.test(await p4.textContent('#profileSummary')));
    const rewritten = await p4.evaluate(() =>
      JSON.parse(window.__folder.get('player.filmroom.json') || '{}').name);
    check(`and the folder is brought up to date (${rewritten})`, rewritten === 'Jude Sanchez');
    await ctx.close();
  }

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
