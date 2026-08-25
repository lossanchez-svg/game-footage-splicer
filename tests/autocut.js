/*
  Auto-Cut assist (v6-C): a proposed tightening, never an action.

  What must be true:
  - proposeCut() is pure and its answers are known by construction: a loose
    clip around a built action window is proposed to start just before the
    action and end a beat after it; a possession ending inside the clip is
    preferred as the cut point ("cut on the touch"); the ramp names the
    fastest stretch inside the kept range.
  - It knows when to stay quiet: a short clip, a clip the report does not
    cover, an already-tight clip — all null, no nagging.
  - The gate arithmetic (realeval/autocut.js): medians per end against
    hand-set trims, with no-opinion clips reported rather than punished.
  - In the app: the "Tighten to the action?" button only appears when there
    is a proposal, one tap trims, and Undo puts it straight back.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, launch } = require('./common');
const { gradeCuts } = require('./realeval/autocut');

/* same construction as the moments suite: stroll, sprint 12..15, possession
   5..7, 8 samples/s over 20s */
function fakeReport({ sprint = true, possession = true } = {}){
  const samples = [];
  let x = 0.2, y = 0.5;
  for (let t = 0; t <= 20; t += 0.125){
    let v = 0.01;
    if (sprint && t >= 12 && t <= 15) v = 0.24;
    x = Math.min(0.95, x + v * 0.125);
    samples.push({ t: +t.toFixed(3), x: +x.toFixed(4), y, conf: 0.6, tracks: 3 });
  }
  return {
    working: { W: 1280, H: 720 },
    result: [{ lost: false, lastGoodAt: 20, samples,
      possession: possession ? [{ start: 5, end: 7 }] : [] }],
  };
}

(async () => {
  const { browser, page, errors, check } = await launch();
  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  /* ---- pure: answers by construction ---- */
  const loose = await page.evaluate(rep =>
    window.__filmroom.proposeCut({ tIn: 0, tOut: 20 }, rep), fakeReport());
  check(`a loose clip is tightened around the action (${loose && loose.tIn}–${loose && loose.tOut})`,
    loose && loose.tIn > 3 && loose.tIn < 5 && loose.tOut > 15 && loose.tOut < 17.5);
  check(`and it says how much quiet goes (“${loose && loose.why}”)`,
    loose && /quiet can go|touches/.test(loose.why) && loose.saved > 5);
  check('the ramp names a fast stretch inside the kept range',
    loose && loose.ramp && loose.ramp.start >= loose.tIn && loose.ramp.end <= loose.tOut &&
    loose.ramp.start >= 11 && loose.ramp.end <= 17);

  const touch = await page.evaluate(rep =>
    window.__filmroom.proposeCut({ tIn: 0, tOut: 10 }, rep), fakeReport({ sprint: false }));
  check(`a possession ending inside the clip is the cut point + a beat (${touch && touch.tOut})`,
    touch && Math.abs(touch.tOut - 7.8) < 0.4 && /touches/.test(touch.why));

  check('a short clip gets no proposal',
    (await page.evaluate(rep => window.__filmroom.proposeCut({ tIn: 5, tOut: 8 }, rep), fakeReport())) === null);
  check('a clip outside the report gets no proposal',
    (await page.evaluate(rep => window.__filmroom.proposeCut({ tIn: 40, tOut: 55 }, rep), fakeReport())) === null);
  check('an already-tight clip gets no proposal — no nagging',
    (await page.evaluate(rep => window.__filmroom.proposeCut({ tIn: 4.5, tOut: 8.0 }, rep),
      fakeReport({ sprint: false }))) === null);

  /* ---- the gate arithmetic ---- */
  {
    const his = [{ tIn: 4, tOut: 9 }, { tIn: 30, tOut: 36 }, { tIn: 50, tOut: 55 }];
    const props = [{ tIn: 4.5, tOut: 8.2 }, { tIn: 31, tOut: 37.2 }, null];
    const g = gradeCuts(his, props);
    check(`gate: medians per end, no-opinion reported apart (in ${g.medianIn}s out ${g.medianOut}s, ${g.noOpinion} no-opinion)`,
      g.proposed === 2 && g.noOpinion === 1 &&
      Math.abs(g.medianIn - 1.0) < 0.01 && Math.abs(g.medianOut - 1.2) < 0.01 && g.ok === true);
    const far = gradeCuts(his.slice(0, 1), [{ tIn: 0.5, tOut: 15 }]);
    check('gate: proposals far from his cuts fail the bar', far.ok === false);
  }

  /* ---- in the app: button appears, one tap trims, Undo restores ---- */
  {
    const STUB = fs.readFileSync(__dirname + '/lockontrack.js', 'utf8')
      .match(/const STUB = `([\s\S]*?)`;/)[1];
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    const pageErrors = [];
    p.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message));
    await p.goto(APP);
    await p.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
    await p.reload();
    await p.setInputFiles('#fileVideo', path.join(FIXTURES, 'two.webm'));
    await p.waitForSelector('#videoWrap', { state: 'visible' });
    await p.waitForFunction(() => document.querySelector('#video').duration > 1);
    await p.evaluate(`(${STUB})(${JSON.stringify([
      { fn: 'parkThenRun', size: 36 },
    ])})`);
    const box = await (await p.$('#overlay')).boundingBox();
    await p.evaluate(() => { document.querySelector('#video').currentTime = 0; });
    await p.waitForTimeout(300);
    await p.click('#toolGrid button[data-tool=spot]');
    await p.mouse.move(box.x + box.width * (100 / 640), box.y + box.height * (180 / 360));
    await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(250);
    await p.click('#toolGrid button[data-tool=select]');
    await p.click('#annList .annItem .kind >> nth=0');
    await p.click('#selTrack');
    await p.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
    await p.waitForTimeout(300);

    // a loose clip over the whole tracked span, saved the ordinary way
    await p.evaluate(() => { document.querySelector('#video').currentTime = 0; });
    await p.waitForTimeout(200);
    await p.click('#btnMarkIn');
    await p.evaluate(() => { document.querySelector('#video').currentTime = 7.5; });
    await p.waitForTimeout(200);
    await p.click('#btnMarkOut');
    await p.click('#btnSaveClip');
    await p.waitForSelector('#clipModal.open');
    await p.fill('#clipTitle', 'Loose cut');
    await p.click('#ratingRow [data-rating=positive]');
    await p.click('#clipSave');
    await p.waitForTimeout(300);
    await p.click('#tabs button[data-tab=clips]');

    check('the offer appears only because a proposal exists',
      await p.isVisible('#clipList [data-act=tighten]'));
    const before = await p.evaluate(() => {
      const c = window.__filmroom.getProject().clips[0];
      return { tIn: c.tIn, tOut: c.tOut };
    });
    await p.click('#clipList [data-act=tighten]');
    await p.waitForTimeout(300);
    const afterCut = await p.evaluate(() => {
      const c = window.__filmroom.getProject().clips[0];
      return { tIn: c.tIn, tOut: c.tOut, ramp: c.ramp };
    });
    check(`one tap tightened it (${before.tIn}–${before.tOut} → ${afterCut.tIn}–${afterCut.tOut})`,
      (afterCut.tOut - afterCut.tIn) < (before.tOut - before.tIn) - 0.5);
    check('the ramp suggestion rode along on the clip', !!afterCut.ramp);
    await p.click('.toast button:has-text("Undo")');
    await p.waitForTimeout(250);
    const restored = await p.evaluate(() => {
      const c = window.__filmroom.getProject().clips[0];
      return { tIn: c.tIn, tOut: c.tOut, ramp: c.ramp || null };
    });
    check('Undo puts it straight back, ramp and all',
      restored.tIn === before.tIn && restored.tOut === before.tOut && restored.ramp === null);
    check('no page errors through the assist', pageErrors.length === 0);
    await ctx.close();
  }

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
