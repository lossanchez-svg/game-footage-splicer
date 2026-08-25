/*
  Reel Studio storyboard (v5-B): the recruiting reel planned across the season.

  What must be true:
  - The pool reads every game this browser knows about, best material first
    (strengths, then teachable moments; work-ons never suggested).
  - "Draft it for me" proposes an order; a person rearranges it — by drag or
    by the ↑↓ buttons — and the plan persists across reloads.
  - Per-play controls work and persist: spotlight toggle, freeze-intro toggle,
    half-second trims (bounded by the clip), an editable context label
    auto-filled from the game.
  - Removing a play offers Undo from its own toast (the friction rule).
  - The position checklist reads his player card and ticks what the plan
    already shows.
  - A play whose game vanished is marked honestly, never silently dropped.
  - The plan travels with the Games folder (reels.filmroom.json, newest wins).
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, launch } = require('./common');

const mkProject = (name, dayOffset, clips) => ({
  version: 1, videoName: name, videoKey: 'filmroom:' + name + ':100',
  videoDate: Date.UTC(2026, 2, 1) + dayOffset * 86400000,
  savedAt: new Date(Date.UTC(2026, 2, 1) + dayOffset * 86400000).toISOString(),
  fps: 30, annotations: [], sessions: [],
  clips: clips.map((c, i) => ({
    id: name + '-' + i, tIn: i * 10, tOut: i * 10 + 6,
    title: c.title || ('Moment ' + i), rating: c.rating,
    tags: c.tags || [], notes: c.notes || '', ask: c.ask || '',
    position: c.position || 'Attacking Mid', format: '9v9',
  })),
});

const SEASON = [
  mkProject('week1.mp4', 0, [
    { rating: 'positive', title: 'Great 1v1 move on the wing' },
    { rating: 'negative', title: 'Heavy touch under pressure' },
    { rating: 'neutral',  title: 'Saw the switch late' },
  ]),
  mkProject('week2.mp4', 7, [
    { rating: 'positive', title: 'Through ball splits the line', ask: 'Where is the space?' },
    { rating: 'positive', title: 'Finish off the back post' },
  ]),
  mkProject('week3.mp4', 14, [
    { rating: 'neutral', title: 'Scanning before the ball arrives' },
  ]),
];

const seedSeason = page => page.evaluate(projects => {
  localStorage.clear();
  localStorage.setItem('filmroom:tourDone', '1');
  for (const p of projects) localStorage.setItem(p.videoKey, JSON.stringify(p));
}, SEASON);

const openStudio = async page => {
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.waitForFunction(() => !document.querySelector('#studioPool .hint') ||
    !/Reading/.test(document.querySelector('#studioPool').textContent));
  await page.waitForTimeout(150);
};

const planTitles = page => page.evaluate(() =>
  window.__filmroom.studio.get().items.map(i => i.title));

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await seedSeason(page);
  await page.reload();

  /* ---- the pool: best material first, work-ons never offered ---- */
  await openStudio(page);
  const pool = await page.evaluate(() => window.__filmroom.studio.suggestions()
    .map(e => ({ title: e.clip.title, rating: e.clip.rating })));
  check(`the season pool is gathered (${pool.length} of 6 saved moments)`, pool.length === 5);
  check('work-ons are never suggested for a recruiting reel',
    pool.every(e => e.rating !== 'negative'));
  const firstNeutral = pool.findIndex(e => e.rating === 'neutral');
  const lastPositive = pool.map(e => e.rating).lastIndexOf('positive');
  check('strengths come before teachable moments', lastPositive < firstNeutral);
  check('the studio works with no video open (it is about the season, not a game)',
    await page.isVisible('#studioModal .box'));

  /* ---- draft it, then the plan belongs to the person ---- */
  await page.click('#studioDraft');
  await page.waitForTimeout(150);
  const drafted = await planTitles(page);
  check(`the draft fills the storyboard (${drafted.length} plays)`, drafted.length === 5);
  check('the draft leads with a strength', /1v1|Through ball|Finish/.test(drafted[0]));
  check('the empty-state hint is gone', !(await page.isVisible('#sbEmpty')));
  const scope = await page.textContent('#studioScope');
  check(`the header counts the plan (${scope})`, /5 plays/.test(scope) && /3 games/.test(scope));

  /* ---- reorder with the buttons ---- */
  const before = await planTitles(page);
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("↓")');
  await page.waitForTimeout(120);
  const after = await planTitles(page);
  check('↓ moves a play later', after[1] === before[0] && after[0] === before[1]);

  /* ---- reorder by dragging the handle ---- */
  const h = await page.$('.sbCard[data-i="0"] .sbHandle');
  const hb = await h.boundingBox();
  const target = await (await page.$('.sbCard[data-i="2"]')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, target.y + target.height * 0.8, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const dragged = await planTitles(page);
  check(`dragging moved the first play down (${dragged[0].slice(0, 18)}… now first)`,
    dragged[0] === after[1] && dragged.includes(after[0]));

  /* ---- the plan survives a reload ---- */
  await page.click('#studioClose');
  await page.reload();
  await openStudio(page);
  check('the plan survives a reload', (await planTitles(page)).join('|') === dragged.join('|'));

  /* ---- per-play controls: toggles ---- */
  const spot0 = await page.evaluate(() => window.__filmroom.studio.get().items[0].spotlight);
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("🎯")');
  await page.waitForTimeout(120);
  check('the spotlight toggle flips and persists',
    await page.evaluate(() => window.__filmroom.studio.get().items[0].spotlight) === !spot0);
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("⏸")');
  await page.waitForTimeout(120);
  check('the freeze-intro toggle flips',
    await page.evaluate(() => window.__filmroom.studio.get().items[0].freezeIntro) === false);

  /* ---- trim: folded away until asked for, half a second at a time ---- */
  check('trim controls are folded away by default',
    await page.evaluate(() => document.querySelectorAll('.sbTrim').length) === 0);
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("✂")');
  await page.waitForTimeout(120);
  check('✂ unfolds the trim row', await page.isVisible('.sbTrim'));
  const trimBefore = await page.evaluate(() => window.__filmroom.studio.get().items[0].trimIn);
  await page.click('.sbTrim button:has-text("+½s")');
  await page.waitForTimeout(120);
  const trimAfter = await page.evaluate(() => window.__filmroom.studio.get().items[0].trimIn);
  check(`+½s tightens the start (${trimBefore}s → ${trimAfter}s)`, trimAfter === trimBefore + 0.5);
  for (let k = 0; k < 15; k++){
    await page.click('.sbTrim button:has-text("+½s")');
  }
  await page.waitForTimeout(150);
  const bounded = await page.evaluate(() => {
    const it = window.__filmroom.studio.get().items[0];
    return { trimIn: it.trimIn, trimOut: it.trimOut, tOut: it.tOut };
  });
  check(`trimming can never eat the whole play (start ${bounded.trimIn} vs end ${bounded.trimOut})`,
    bounded.trimIn <= bounded.trimOut - 0.5);

  /* ---- the context label: auto-filled from the game, editable ---- */
  const label = await page.inputValue('.sbCard[data-i="1"] .sbSub input');
  check(`labels are filled from the game (${label})`, /week\d · (Feb|Mar) \d+, 2026/.test(label));
  await page.fill('.sbCard[data-i="1"] .sbSub input', 'vs Slammers FC · State Cup');
  await page.press('.sbCard[data-i="1"] .sbSub input', 'Tab');
  await page.waitForTimeout(120);
  check('an edited label persists',
    await page.evaluate(() => window.__filmroom.studio.get().items[1].label) === 'vs Slammers FC · State Cup');

  /* ---- removing a play offers a way back ---- */
  const removed = (await planTitles(page))[0];
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("✕")');
  await page.waitForTimeout(150);
  check('the play is out of the plan', !(await planTitles(page)).includes(removed));
  await page.click('.toast button:has-text("Undo")');
  await page.waitForTimeout(150);
  check('and Undo puts it straight back', (await planTitles(page)).includes(removed));

  /* ---- suggestions never offer what the plan already holds ---- */
  const dup = await page.evaluate(() => {
    const inPlan = new Set(window.__filmroom.studio.get().items.map(i => i.gameName + ' ' + i.clipId));
    return window.__filmroom.studio.suggestions().filter(e => inPlan.has(e.gameName + ' ' + e.clip.id)).length;
  });
  check('nothing already planned is suggested again', dup === 0);

  /* ---- the reel title persists ---- */
  await page.fill('#studioTitle', 'Jude Sanchez — 2026 season');
  await page.press('#studioTitle', 'Tab');
  await page.waitForTimeout(120);
  await page.click('#studioClose');
  await page.reload();
  await openStudio(page);
  check('the reel title is remembered',
    await page.inputValue('#studioTitle') === 'Jude Sanchez — 2026 season');

  /* ---- the position checklist reads his player card ---- */
  check('no player card: no checklist pretends to know his position',
    !(await page.isVisible('#studioChecklist')));
  await page.evaluate(() => {
    localStorage.setItem('filmroom:playerCard', JSON.stringify({
      name: 'Jude Sanchez', positions: 'Attacking Mid', savedAt: new Date().toISOString() }));
  });
  await page.reload();
  await openStudio(page);
  check('with a card, the checklist appears', await page.isVisible('#studioChecklist'));
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('#studioChecklist .chip')].map(c => ({
      text: c.textContent, got: c.classList.contains('got') })));
  check(`it lists what coaches look for in his position (${chips.map(c => c.text).join(', ')})`,
    chips.length === 4);
  const got1v1 = chips.find(c => /1v1/.test(c.text));
  check('a covered item is ticked (the 1v1 play is in the plan)', got1v1 && got1v1.got);
  const finishing = chips.find(c => /Finishing/.test(c.text));
  check('Finishing is ticked too (the back-post finish)', finishing && finishing.got);

  /* ---- a vanished game is marked, never dropped ---- */
  await page.evaluate(() => localStorage.removeItem('filmroom:week3.mp4:100'));
  await page.click('#studioClose');
  await openStudio(page);
  const missing = await page.evaluate(() =>
    window.__filmroom.studio.get().items.filter(i => i.missing).length);
  check('a play from a vanished game is marked, its place kept', missing === 1);
  check('the card says so on its face',
    await page.evaluate(() => [...document.querySelectorAll('.sbCard.missing')].length) === 1);

  await page.close();

  /* ---- the plan travels with the Games folder ---- */
  const ballB64 = fs.readFileSync(path.join(FIXTURES, 'ball.webm')).toString('base64');
  const freshWithFolder = async seed => {
    const ctx = await browser.newContext({ acceptDownloads: true });
    const p = await ctx.newPage();
    await p.addInitScript(({ b64, seedJson }) => {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      const files = new Map(Object.entries(JSON.parse(seedJson)));
      window.__folder = files;
      const fileHandle = name => ({
        kind: 'file', name,
        getFile: async () => new File([files.get(name) || ''], name, { type: 'application/json' }),
        createWritable: async () => {
          let buf = '';
          return { write: async c => { buf += c; }, close: async () => { files.set(name, buf); } };
        },
      });
      const dir = {
        kind: 'directory', name: 'Game Film',
        queryPermission: async () => 'granted', requestPermission: async () => 'granted',
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
    await p.goto(APP);
    await p.evaluate(projects => {
      localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1');
      for (const pr of projects) localStorage.setItem(pr.videoKey, JSON.stringify(pr));
    }, SEASON);
    await p.reload();
    return { ctx, p };
  };
  const connectFolder = async p => {
    await p.click('#btnLibrary');
    await p.waitForSelector('#libModal.open');
    await p.click('#libChoose');
    await p.waitForTimeout(400);
    await p.click('#libClose');
  };

  {
    const { ctx, p } = await freshWithFolder({});
    await connectFolder(p);
    await openStudio(p);
    await p.click('#studioDraft');
    await p.waitForTimeout(400);
    const filed = await p.evaluate(() => {
      const txt = window.__folder.get('reels.filmroom.json');
      return txt ? JSON.parse(txt) : null;
    });
    check('drafting the plan writes reels.filmroom.json into the Games folder',
      filed && Array.isArray(filed.items) && filed.items.length === 5);
    await ctx.close();
  }
  {
    const seeded = {
      'reels.filmroom.json': JSON.stringify({
        title: 'From the Mac', items: [{
          gameName: 'week1.mp4', date: Date.UTC(2026, 2, 1), clipId: 'week1.mp4-0',
          title: 'Great 1v1 move on the wing', rating: 'positive',
          tIn: 0, tOut: 6, trimIn: 0, trimOut: 6,
          spotlight: true, freezeIntro: true, label: 'week1 · Mar 1, 2026',
        }],
        savedAt: new Date(Date.now() + 5000).toISOString(),
      }),
    };
    const { ctx, p } = await freshWithFolder(seeded);
    await connectFolder(p);
    await openStudio(p);
    check('a second device picks the plan up from the folder',
      await p.inputValue('#studioTitle') === 'From the Mac' &&
      (await p.evaluate(() => window.__filmroom.studio.get().items.length)) === 1);
    await ctx.close();
  }

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
