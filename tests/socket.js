/*
  The metadata socket (v6-D): outside intelligence plugs in through two
  versioned files, with no network and no pixels.

  What must be true:
  - filmroom-metadata.json carries the season's WORDS AND NUMBERS — clips,
    tags, ratings, notes, his questions and answers, moment counts, track
    summaries, his card, the current plan — and never a pixel: no photo, no
    data: URIs, whatever is in the card.
  - filmroom-reelplan.json imports into the storyboard as a reviewable
    DRAFT: resolved against the real clip pool (snapshots refreshed), trims
    clamped into each clip, unknown plays kept and marked ⚠ rather than
    dropped, the old plan one Undo away.
  - A wrong file, a newer version, an empty plan: refused in plain words,
    the current plan untouched.
  - Round trip: the plan exported inside the metadata re-imports losslessly.
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const { APP, launch } = require('./common');

const mkProject = (name, clips) => ({
  version: 1, videoName: name, videoKey: 'filmroom:' + name + ':100',
  videoDate: Date.UTC(2026, 2, 1), savedAt: new Date().toISOString(),
  fps: 30, sessions: [{ when: '2026-03-02', title: 'Week 1',
    entries: [{ clipId: name + '-0', title: 'Great 1v1 move',
      question: 'What did you see first?', answer: 'their six stepped up' }],
    wentWell: ['scanning'], workOn: 'first touch' }],
  momentStats: { accepted: 2, rejected: 1 },
  annotations: [{ id: 's1', type: 'spot', color: '#ffd60a', label: '81', r: 0.03,
    tStart: 0, tEnd: 12, keys: [{ t: 0, x: 0.2, y: 0.5 }, { t: 12, x: 0.8, y: 0.5 }] }],
  clips: clips.map((c, i) => ({
    id: name + '-' + i, tIn: i * 10, tOut: i * 10 + 6,
    title: c.title, rating: c.rating, tags: c.tags || [], notes: c.notes || '',
    ask: '', position: 'Attacking Mid', format: '9v9',
  })),
});
const GAME1 = mkProject('week1.mp4', [
  { title: 'Great 1v1 move', rating: 'positive', tags: ['Great move (1v1)'] },
  { title: 'Saw the switch late', rating: 'neutral' },
]);
const GAME2 = mkProject('week2.mp4', [
  { title: 'Finish at the back post', rating: 'positive', notes: 'back post again' },
]);
const CARD = { name: 'Jude Sanchez', jersey: '81', gradYear: '2032',
  positions: 'Attacking Mid', contact: 'reach@example.com',
  photo: 'data:image/jpeg;base64,SHOULDNEVERAPPEAR',
  savedAt: new Date().toISOString() };

(async () => {
  const { browser, page, errors, check } = await launch();
  await page.goto(APP);
  await page.evaluate(({ g1, g2, card }) => {
    localStorage.clear();
    localStorage.setItem('filmroom:tourDone', '1');
    localStorage.setItem(g1.videoKey, JSON.stringify(g1));
    localStorage.setItem(g2.videoKey, JSON.stringify(g2));
    localStorage.setItem('filmroom:playerCard', JSON.stringify(card));
    localStorage.setItem('filmroom:reelStudio', JSON.stringify({
      title: 'Draft one', savedAt: new Date().toISOString(),
      items: [{ gameName: 'week1.mp4', date: Date.UTC(2026, 2, 1), clipId: 'week1.mp4-0',
        title: 'Great 1v1 move', rating: 'positive', tIn: 0, tOut: 6,
        trimIn: 1, trimOut: 5.5, spotlight: true, freezeIntro: false,
        label: 'vs Slammers', tags: [], notes: '' }] }));
  }, { g1: GAME1, g2: GAME2, card: CARD });
  await page.reload();

  /* ---- the metadata export: words and numbers, never pixels ---- */
  const meta = await page.evaluate(() => window.__filmroom.socket.metadata());
  check(`the file names its format and version (${meta.format} v${meta.version})`,
    meta.format === 'filmroom-metadata' && meta.version === 1);
  check('his card rides along — without the photo',
    meta.player && meta.player.name === 'Jude Sanchez' && !('photo' in meta.player));
  check('not a pixel anywhere in the whole export',
    !JSON.stringify(meta).includes('data:image'));
  const g1 = meta.games.find(g => g.name === 'week1.mp4');
  check(`every game carries its clips with their words (${meta.games.length} games)`,
    meta.games.length === 2 && g1.clips.length === 2 &&
    g1.clips[0].title === 'Great 1v1 move' && g1.clips[0].tags[0] === 'Great move (1v1)');
  check('his questions and answers are in',
    g1.sessions[0].answers[0].answer === 'their six stepped up');
  check('moment counts and track summaries are in',
    g1.momentStats.accepted === 2 && g1.tracks.length === 1 &&
    g1.tracks[0].label === '81' && g1.tracks[0].keys === 2);
  check('the current reel plan is in, by reference not by copy of the pool',
    meta.reelPlan && meta.reelPlan.items.length === 1 &&
    meta.reelPlan.items[0].clipId === 'week1.mp4-0' && meta.reelPlan.items[0].trimIn === 1);

  /* ---- the reel plan import: a reviewable draft ---- */
  const plan = {
    format: 'filmroom-reelplan', version: 1, title: 'From the Autopilot',
    items: [
      { game: 'week2.mp4', clipId: 'week2.mp4-0', trimIn: 1, trimOut: 5,
        freezeIntro: false, label: 'vs Inter · the winner' },
      { game: 'week1.mp4', clipId: 'week1.mp4-0' },
      { game: 'gone.mp4', clipId: 'x9', title: 'A play nobody here can see', trimIn: 2, trimOut: 6 },
    ],
  };
  const r = await page.evaluate(p => window.__filmroom.socket.importPlan(p), plan);
  check(`the plan loads as a draft (${r.loaded} plays, ${r.missing} marked)`,
    r.loaded === 3 && r.missing === 1 && !r.error);
  const loaded = await page.evaluate(() => window.__filmroom.studio.get());
  check('the order and title are the file’s', loaded.title === 'From the Autopilot' &&
    loaded.items[0].clipId === 'week2.mp4-0' && loaded.items[1].clipId === 'week1.mp4-0');
  check('resolved plays carry refreshed snapshots from the real pool',
    loaded.items[1].title === 'Great 1v1 move' && loaded.items[1].rating === 'positive');
  check('trims are clamped inside the real clip',
    loaded.items[0].trimIn === 1 && loaded.items[0].trimOut === 5 &&
    loaded.items[0].freezeIntro === false);
  check('the unknown play is kept and marked, never dropped',
    loaded.items[2].missing === true && /nobody here can see/.test(loaded.items[2].title));

  /* ---- refusals, in plain words, plan untouched ---- */
  const bad = await page.evaluate(p => window.__filmroom.socket.importPlan(p),
    { format: 'something-else', version: 1, items: [{}] });
  check('a wrong file is refused and says why', /not a reel plan/.test(bad.error));
  const newer = await page.evaluate(p => window.__filmroom.socket.importPlan(p),
    { format: 'filmroom-reelplan', version: 99, items: [{}] });
  check('a newer version asks for an app update', /newer Film Room/.test(newer.error));
  const empty = await page.evaluate(p => window.__filmroom.socket.importPlan(p),
    { format: 'filmroom-reelplan', version: 1, items: [] });
  check('an empty plan is refused', /no plays/.test(empty.error));
  check('refusals never touched the loaded plan',
    (await page.evaluate(() => window.__filmroom.studio.get().items.length)) === 3);

  /* ---- round trip: the exported plan re-imports losslessly ---- */
  const meta2 = await page.evaluate(() => window.__filmroom.socket.metadata());
  const again = await page.evaluate(p => window.__filmroom.socket.importPlan(p),
    { format: 'filmroom-reelplan', version: 1, title: 'RT', items: meta2.reelPlan.items });
  const rt = await page.evaluate(() => window.__filmroom.studio.get());
  check('round trip: same plays, same order, same trims',
    !again.error &&
    rt.items.map(i => i.gameName + '/' + i.clipId + '@' + i.trimIn + '-' + i.trimOut).join('|') ===
    meta2.reelPlan.items.map(i => i.game + '/' + i.clipId + '@' + i.trimIn + '-' + i.trimOut).join('|'));

  /* ---- through the real UI: file in, file out ---- */
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#studioData'),
  ]);
  check(`the season data downloads named after him (${dl.suggestedFilename()})`,
    /Jude Sanchez.*season data\.json$/.test(dl.suggestedFilename()));

  const tmp = path.join(os.tmpdir(), 'reelplan-test.json');
  fs.writeFileSync(tmp, JSON.stringify(plan));
  await page.setInputFiles('#studioPlanFile', tmp);
  await page.waitForTimeout(400);
  check('loading a plan file announces the draft and offers Undo',
    /loaded as a draft/.test(await page.evaluate(() =>
      [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '))) &&
    (await page.evaluate(() => !!document.querySelector('.toast button'))));
  await page.click('.toast button:has-text("Undo")');
  await page.waitForTimeout(250);
  check('Undo brings the previous plan back',
    (await page.evaluate(() => window.__filmroom.studio.get().title)) === 'RT');
  fs.unlinkSync(tmp);

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
