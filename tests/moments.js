/*
  The Moment Finder (v6-B): recall automated, judgment kept.

  What must be true:
  - momentCandidates() is pure over a tracking report and its answers are
    known by construction: a built possession window and a built sprint each
    become a candidate, padded into a playable moment and said in plain
    words; a quiet stroll yields NOTHING (the adaptive threshold has a floor,
    so a boring game cannot invent excitement from its own percentiles).
  - The camera's measured pan counts toward his speed — a sprint the camera
    follows is still a sprint.
  - End to end with the scripted detector: pressing "Find his moments" runs
    the scan, lists candidates, ▶ previews, YES becomes an ordinary clip,
    NO is only counted — and the counts say so out loud.
  - No ring → the button explains instead of doing nothing.
  - The gate arithmetic (realeval/moments.js): recall and review cost graded
    on fabricated choices where the right answer is constructed.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');
const { gradeGame } = require('./realeval/moments');

/* a fabricated tracking report: quiet stroll, sprint at 12..15, possession
   window 5..7, all at 8 samples/s */
function fakeReport({ sprint = true, possession = true, pan = false } = {}){
  const samples = [];
  let x = 0.2, y = 0.5;
  for (let t = 0; t <= 20; t += 0.125){
    let v = 0.01;                       // strolling
    if (sprint && t >= 12 && t <= 15) v = pan ? 0.10 : 0.24;   // sprinting
    x = Math.min(0.95, x + v * 0.125);
    const s = { t: +t.toFixed(3), x: +x.toFixed(4), y, conf: 0.6, tracks: 3 };
    if (pan && sprint && t >= 12 && t <= 15) s.pan = [0.14 * 0.125 * 1280, 0];
    samples.push(s);
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
  const cands = await page.evaluate(rep => window.__filmroom.moments.candidates(rep), fakeReport());
  check(`a built possession and a built sprint are found (${cands.length} candidates)`,
    cands.length === 2);
  const ballCand = cands.find(c => /ball/.test(c.why));
  const runCand = cands.find(c => /run|sprint/.test(c.why));
  check(`the ball moment is padded into a playable window (${ballCand && ballCand.start}–${ballCand && ballCand.end})`,
    ballCand && Math.abs(ballCand.start - 3) < 0.3 && Math.abs(ballCand.end - 8.5) < 0.3);
  check(`the sprint reads as a run in plain words (“${runCand && runCand.why}”)`,
    runCand && /long hard run/.test(runCand.why) &&
    runCand.start > 9.5 && runCand.end < 17);
  const quiet = await page.evaluate(rep => window.__filmroom.moments.candidates(rep),
    fakeReport({ sprint: false, possession: false }));
  check('a quiet stroll yields nothing — no excitement invented from percentiles',
    quiet.length === 0);
  const panned = await page.evaluate(rep => window.__filmroom.moments.candidates(rep),
    fakeReport({ possession: false, pan: true }));
  check('a sprint the camera pans along with is still a sprint',
    panned.length === 1 && /run|sprint/.test(panned[0].why));

  /* ---- the gate arithmetic, on constructed choices ---- */
  {
    const chosen = [
      { tIn: 3, tOut: 8, title: 'his turn' },
      { tIn: 30, tOut: 34, title: 'the recovery run' },
      { tIn: 60, tOut: 63, title: 'nobody found this one' },
    ];
    const candsG = [
      { start: 4, end: 9 }, { start: 29, end: 33 },
      { start: 45, end: 47 }, { start: 50, end: 52 },
    ];
    const g = gradeGame(chosen, candsG);
    check(`gate: recall counts overlapped choices (${g.hit}/${g.chosen})`,
      g.hit === 2 && Math.abs(g.recall - 2 / 3) < 0.01 && g.recallOk === false);
    check(`gate: review cost is candidates per accepted moment (${g.candidatesPerAccept})`,
      g.candidatesPerAccept === 2 && g.costOk === true);
    check('gate: the missed moment is named, not averaged away',
      g.missed.length === 1 && g.missed[0].title === 'nobody found this one');
    const perfect = gradeGame(chosen.slice(0, 2), candsG.slice(0, 2));
    check('gate: surfacing everything they chose passes', perfect.recallOk && perfect.costOk);
  }

  /* ---- no ring: the button explains ---- */
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'two.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 1);
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#btnFindMoments');
  await page.waitForTimeout(250);
  check('pressing with no ring explains what to do first',
    /ring on him/i.test(await page.evaluate(() =>
      [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '))));
  await page.close();

  /* ---- end to end with the scripted detector ---- */
  {
    const STUB = require('fs').readFileSync(__dirname + '/lockontrack.js', 'utf8')
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
      { fn: 'ballA', size: 36 }, { fn: 'ballB', size: 36 },
      { fn: 'matchBall', size: 10, kind: 'ball', score: 0.5 },
    ])})`);
    /* the ring on A at t=0, then one press does the rest */
    const box = await (await p.$('#overlay')).boundingBox();
    await p.evaluate(() => { document.querySelector('#video').currentTime = 0; });
    await p.waitForTimeout(300);
    await p.click('#toolGrid button[data-tool=spot]');
    await p.mouse.move(box.x + box.width * (58 / 640), box.y + box.height * (180 / 360));
    await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(250);
    await p.click('#tabs button[data-tab=clips]');
    await p.click('#btnFindMoments');
    await p.waitForSelector('#momentsModal.open', { timeout: 240000 });
    await p.waitForTimeout(200);
    const listed = await p.evaluate(() =>
      [...document.querySelectorAll('#momentsList .annItem')].map(r => r.textContent));
    check(`the scan ran and listed candidates (${listed.length})`, listed.length >= 1);
    check('the built possession stretch is one of them (said as the ball)',
      listed.some(l => /ball/.test(l)));

    const clipsBefore = await p.evaluate(() => window.__filmroom.getProject().clips.length);
    await p.click('#momentsList .annItem >> nth=0 >> button:has-text("Yes")');
    await p.waitForTimeout(250);
    const after = await p.evaluate(() => ({
      clips: window.__filmroom.getProject().clips.length,
      first: window.__filmroom.getProject().clips[0],
      stats: window.__filmroom.getProject().momentStats,
    }));
    check('YES makes it an ordinary clip', after.clips === clipsBefore + 1);
    check(`the clip says where it came from (${(after.first.notes || '').slice(0, 40)}…)`,
      /moment scan/i.test(after.first.notes));
    check('the accept is counted', after.stats && after.stats.accepted === 1);

    /* reject deterministically: reopen the list with two known candidates */
    await p.evaluate(() => window.__filmroom.moments.open([
      { start: 1, end: 3, score: 2, reasons: ['a sprint'], why: 'a sprint' },
      { start: 5, end: 7, score: 1, reasons: ['a busy stretch right around him'],
        why: 'a busy stretch right around him' },
    ]));
    await p.waitForTimeout(150);
    await p.click('#momentsList .annItem >> nth=1 >> button:has-text("Not one")');
    await p.waitForTimeout(200);
    const stats2 = await p.evaluate(() => window.__filmroom.getProject().momentStats);
    check('NO is only counted', stats2.rejected === 1);
    check('and the tally says the counts are only counts',
      /only counts/.test(await p.textContent('#momentsTally')));
    await p.click('#momentsClose');
    check('no page errors through the finder', pageErrors.length === 0);
    await ctx.close();
  }

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
