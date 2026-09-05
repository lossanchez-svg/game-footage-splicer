/*
  Make his reel (one press): the finder recalls, the parent judges — but the
  clicking is gone. From a ring on him, one press scans the game, picks the
  moments that stood out, trims each to the action, orders them the way the
  studio teaches (best first, end on a high) and titles the reel. The parent
  looks it over and presses Save; one Undo takes the whole draft back.

  What must be true:
  - pickReelMoments() is PURE and provable: best-first, the second-best last,
    the rest in game order; the four-minute budget and the count cap hold;
    short lists are left in rank order.
  - No video / no ring: it says what to do, adds nothing.
  - End to end with the scripted detector on two.webm (the same constructed
    possession + sprint the finder suite uses): one press yields clips that
    are IN the reel, in the pick order, each one inside the candidate it came
    from (auto-cut only ever tightens within), the title comes from the game,
    the clips say where they came from, anything already in the reel leads,
    and the toast's Undo removes every clip and reel entry it added.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();
  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  /* ---- the pure picker ---- */
  const pick = (cands, opts) => page.evaluate(([c, o]) => window.__filmroom.reel.pick(c, o), [cands, opts || {}]);
  const c = (start, end, score, why) => ({ start, end, score, reasons: [why], why });
  const five = [c(10, 16, 1, 'a busy stretch right around him'), c(30, 36, 3, 'he had the ball'),
                c(50, 54, 2, 'a sprint'), c(70, 78, 2, 'a long hard run'), c(90, 94, 1, 'a busy stretch right around him')];
  const order = await pick(five);
  check(`the best play leads (${order[0].start}s, score ${order[0].score})`, order[0].start === 30);
  check(`the second-best ends it on a high (${order[order.length - 1].start}s)`, order[order.length - 1].start === 70);
  check('the rest run in game order between them',
    order.slice(1, -1).map(x => x.start).join(',') === '10,50,90');
  const budget = await pick(five, { maxTotal: 12 });
  check(`the budget holds (${budget.map(x => x.end - x.start).join('+')}s <= 12s)`,
    budget.reduce((s, x) => s + x.end - x.start, 0) <= 12 && budget.length >= 1);
  const capped = await pick(five, { maxCount: 2 });
  check(`the count cap holds and short lists stay in rank order (${capped.map(x => x.start)})`,
    capped.length === 2 && capped[0].start === 30 && capped[1].start === 70);
  check('nothing in, nothing out', (await pick([])).length === 0);

  /* ---- guards: no video, no ring ---- */
  await page.evaluate(() => window.__filmroom.reel.make());
  await page.waitForTimeout(200);
  check('pressing with no video explains what to do first',
    /Open a game video first/.test(await page.evaluate(() => document.body.textContent)));
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'two.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 1);
  await page.click('#tabs button[data-tab=clips]');
  check('the button is there, in the reel section, with a plain-words tip',
    await page.evaluate(() => {
      const b = document.querySelector('#reelSection #btnAutoReel');
      return !!b && /look it over/.test(b.getAttribute('data-tip') || '');
    }));
  await page.click('#btnAutoReel');
  await page.waitForTimeout(300);
  check('pressing with no ring explains what to do first',
    await page.evaluate(() => [...document.querySelectorAll('.toast')].some(t => /ring on him first/.test(t.textContent))));
  check('and nothing was added', await page.evaluate(() =>
    window.__filmroom.getProject().clips.length === 0 && !(window.__filmroom.getProject().reel || []).length));

  /* ---- end to end with the scripted detector ---- */
  const STUB = fs.readFileSync(__dirname + '/lockontrack.js', 'utf8').match(/const STUB = `([\s\S]*?)`;/)[1];
  await page.evaluate(`(${STUB})(${JSON.stringify([
    { fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 },
    { fn: 'matchBall', size: 10, kind: 'ball', score: 0.5 },
  ])})`);
  /* a clip the parent already chose stays at the front of the list */
  await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    p.clips.push({ id: 'mine', tIn: 0.5, tOut: 1.5, title: 'My own pick', rating: 'strength', tags: [], notes: '', ask: '' });
    p.reel = ['mine'];
  });
  await page.click('#tabs button[data-tab=draw]');
  const box = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);
  await page.click('#toolGrid button[data-tool=spot]');
  await page.mouse.move(box.x + box.width * (58 / 640), box.y + box.height * (180 / 360));
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#btnAutoReel');
  await page.waitForSelector('#trackPill', { state: 'visible', timeout: 15000 });
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /Drafted a reel/.test(t.textContent)), null, { timeout: 10000 });

  const after = await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    const rep = window.__filmroom.trackReport;
    const cands = window.__filmroom.moments.candidates(rep);
    const picks = window.__filmroom.reel.pick(cands);
    return { clips: p.clips, reel: p.reel, title: p.reelTitle, cands, picks,
             titleField: document.querySelector('#reelTitle').value,
             tabActive: document.querySelector('#panel-clips').classList.contains('active'),
             toast: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | ') };
  });
  const added = after.clips.filter(k => /Make his reel/.test(k.notes || ''));
  check(`one press made clips out of the scan (${added.length} of ${after.cands.length} candidates)`,
    added.length >= 1 && added.length === after.picks.length);
  check('every one of them is in the reel, and the parent\'s own pick still leads',
    after.reel[0] === 'mine' && added.every(k => after.reel.includes(k.id)) &&
    after.reel.length === 1 + added.length);
  const reelOrder = after.reel.slice(1).map(id => after.clips.find(k => k.id === id));
  check('the reel runs in pick order, each clip inside the moment it came from (auto-cut only ever tightens)',
    reelOrder.length === after.picks.length &&
    reelOrder.every((k, i) => k && k.tIn >= after.picks[i].start - 1e-6 && k.tOut <= after.picks[i].end + 1e-6 && k.tOut > k.tIn));
  check(`the possession moment is one of them (${added.map(k => k.title).join(' / ')})`,
    added.some(k => /ball/i.test(k.notes)));
  check(`the reel is titled from the game (“${after.title}”) and the field shows it`,
    /two/.test(after.title || '') && after.titleField === after.title);
  check('it lands on the Clips tab where the reel lives', after.tabActive);
  check(`the toast says how many and what to do next (${after.toast.slice(0, 60)}…)`,
    /Drafted a reel of \d+ moment/.test(after.toast) && /Save as one video/.test(after.toast));

  /* the toast's own Undo takes the whole draft back — clips and reel entries */
  await page.click('.toastBtn');
  await page.waitForTimeout(250);
  const undone = await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    return { clips: p.clips.map(k => k.id), reel: p.reel };
  });
  check('Undo removes every clip the press added and leaves the parent\'s own',
    undone.clips.length === 1 && undone.clips[0] === 'mine');
  check('and the reel is back to what it was', JSON.stringify(undone.reel) === JSON.stringify(['mine']));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
