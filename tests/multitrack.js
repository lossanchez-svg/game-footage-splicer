/*
  Tracking beyond the basics: several players in one pass, working BACKWARDS
  from an anchor, and the reason both were worth doing — auto-track used
  to follow a player only as far as the spotlight's End time, which defaults to
  four seconds after the ring is placed. Pressing Track on a fresh ring
  therefore followed the player for four seconds and stopped — indistinguishable
  from "the tracker doesn't work". Both are covered here.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const TWO = path.join(FIXTURES, 'two.webm');
const BALL = path.join(FIXTURES, 'ball.webm');

/* where each ball actually is, from the fixture's own formulas */
const ballA = t => ({ x: (58 + 40 * t) / 640, y: (180 + 60 * Math.sin(t)) / 360 });
const ballB = t => ({ x: (578 - 45 * t) / 640, y: (108 + 50 * Math.cos(1.1 * t)) / 360 });

const spotAt = (page, id, t) => page.evaluate(([id, t]) => {
  const a = window.__filmroom.getProject().annotations.find(x => x.id === id);
  return a ? window.__filmroom.spotPos(a, t) : null;
}, [id, t]);

const placeSpot = async (page, box, pos, label) => {
  await page.click('#toolGrid button[data-tool=spot]');
  await page.fill('#labelInput', label);
  await page.mouse.move(box.x + box.width * pos.x, box.y + box.height * pos.y);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(200);
  return page.evaluate(() => {
    const a = window.__filmroom.getProject().annotations.filter(x => x.type === 'spot');
    return a[a.length - 1].id;
  });
};

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  // ============ the bug: a fresh ring followed for only four seconds ============
  await page.setInputFiles('#fileVideo', BALL);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  let box = await (await page.$('#overlay')).boundingBox();

  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(200);
  const soloId = await placeSpot(page, box, ballA(0), 'Marco');
  /* This used to assert the fresh window was exactly 4s, which was really a
     stand-in for "auto-track is not bounded by how long the ring is shown for".
     A spotlight now lasts a play rather than four seconds, so the stand-in no
     longer says anything — the guarantee is tested directly instead: give the
     ring a deliberately short window and require the run to ignore it. */
  await page.evaluate(id => {
    const a = window.__filmroom.getProject().annotations.find(x => x.id === id);
    a.tEnd = a.tStart + 3;            // short window, not a declared end
  }, soloId);
  const freshEnd = await page.evaluate(id => {
    const a = window.__filmroom.getProject().annotations.find(x => x.id === id);
    return a.tEnd - a.tStart;
  }, soloId);
  check('the ring is shown for a short window (' + freshEnd + 's)', freshEnd === 3);

  // press Track without any of the End-time ritual — the way a first-timer would
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 120000 });
  await page.waitForTimeout(300);

  const followed = await page.evaluate(id => {
    const a = window.__filmroom.getProject().annotations.find(x => x.id === id);
    return { keys: a.keys.length, last: a.keys[a.keys.length - 1].t, tEnd: a.tEnd };
  }, soloId);
  check('pressing Track with no setup follows well past four seconds (to ' +
    followed.last.toFixed(1) + 's)', followed.last > 6);
  check('and the ring stays visible for as long as it now follows him (ends ' +
    followed.tEnd.toFixed(1) + 's)', followed.tEnd >= followed.last - 0.01);

  for (const t of [3, 5, 7]){
    const got = await spotAt(page, soloId, t);
    const want = ballA(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    check(`still on the ball at t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }

  // ============ two players, one pass ============
  await page.reload();
  await page.setInputFiles('#fileVideo', TWO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  box = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(250);

  check('the follow-everyone button is hidden with nothing to follow',
    !(await page.isVisible('#btnTrackAll')));

  const idA = await placeSpot(page, box, ballA(0), 'Marco');
  check('one ring is still not "everyone"', !(await page.isVisible('#btnTrackAll')));
  const idB = await placeSpot(page, box, ballB(0), 'Their 6');
  check('the button appears once two rings are on screen', await page.isVisible('#btnTrackAll'));

  await page.click('#toolGrid button[data-tool=select]');
  const t0 = Date.now();
  await page.click('#btnTrackAll');
  await page.waitForSelector('#trackPill', { state: 'visible', timeout: 5000 });
  // the pill starts at a placeholder "0%" and is rewritten once the first sample
  // lands — wait for that rather than racing it
  await page.waitForFunction(() => /lock/.test(document.querySelector('#trackPct').textContent),
    { timeout: 20000 }).catch(() => {});
  const pill = await page.textContent('#trackPill');
  check('the pill says how many it is following (' + pill.replace(/\s+/g, ' ').trim() + ')',
    /2 players/.test(pill));
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 180000 });
  const secs = (Date.now() - t0) / 1000;
  await page.waitForTimeout(300);

  /* These two run straight through each other: they are 0.30 apart at t=4,
     0.027 apart at t=6 (overlapping — the ball is 0.028 wide), and 0.31 apart
     again by t=7. So the tolerance is tight where they are separate, and at the
     crossing the property worth asserting is that each ring is still ON its own
     ball and comes out the far side locked. Tracking ball A ALONE in this same
     fixture gives the identical 0.035 at t=6, so the crossing costs the same
     whether one player is tracked or two — following several at once does not
     make any of them worse. */
  for (const t of [2, 4, 7]){
    const gotA = await spotAt(page, idA, t), wantA = ballA(t);
    const errA = Math.hypot(gotA.x - wantA.x, gotA.y - wantA.y);
    check(`first player tracked at t=${t} (err ${errA.toFixed(3)})`, errA < 0.03);
    const gotB = await spotAt(page, idB, t), wantB = ballB(t);
    const errB = Math.hypot(gotB.x - wantB.x, gotB.y - wantB.y);
    check(`second player tracked at t=${t} (err ${errB.toFixed(3)})`, errB < 0.03);
  }
  const crossA = await spotAt(page, idA, 6), crossB = await spotAt(page, idB, 6);
  const errCrossA = Math.hypot(crossA.x - ballA(6).x, crossA.y - ballA(6).y);
  const errCrossB = Math.hypot(crossB.x - ballB(6).x, crossB.y - ballB(6).y);
  check(`each ring stays on its own player through the crossing (err ${errCrossA.toFixed(3)} / ${errCrossB.toFixed(3)})`,
    errCrossA < 0.05 && errCrossB < 0.05);

  check('the two rings did not collapse onto the same player', await page.evaluate(
    ([a, b]) => {
      const p = window.__filmroom.getProject();
      const pa = window.__filmroom.spotPos(p.annotations.find(x => x.id === a), 4);
      const pb = window.__filmroom.spotPos(p.annotations.find(x => x.id === b), 4);
      return Math.hypot(pa.x - pb.x, pa.y - pb.y) > 0.15;
    }, [idA, idB]));

  const traces = await page.evaluate(() => (window.__trackTraces || []).map(t => t.length));
  check('both were followed in the SAME pass, not one after the other (' +
    traces.join(' + ') + ' samples in ' + secs.toFixed(0) + 's)',
    traces.length === 2 && traces[0] > 10 && traces[1] > 10);

  check('undo puts both rings back where they started', await page.evaluate(() => {
    const before = window.__filmroom.getProject().annotations
      .filter(a => a.type === 'spot').map(a => a.keys.length);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    const after = window.__filmroom.getProject().annotations
      .filter(a => a.type === 'spot').map(a => a.keys.length);
    return before.every(n => n > 2) && after.every(n => n <= 2);
  }));

  // ============ backwards, from an anchor ============
  // The real use: you notice the moment the ball arrives, but the coaching
  // point is the run he made to get there. Put the ring on him at the moment
  // that matters and work back.
  // clear the autosave first: this fixture was already tracked earlier in this
  // suite, and restoring that work would leave two spotlights in the list
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();
  await page.setInputFiles('#fileVideo', BALL);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  box = await (await page.$('#overlay')).boundingBox();

  await page.evaluate(() => { document.querySelector('#video').currentTime = 6; });
  await page.waitForTimeout(300);
  const backId = await placeSpot(page, box, ballA(6), 'Marco');
  check('the anchor is the only ring in play',
    await page.evaluate(() => window.__filmroom.getProject().annotations.length) === 1);
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');

  check('a spotlight offers both directions',
    await page.isVisible('#selTrack') && await page.isVisible('#selTrackBack'));

  const beforeStart = await page.evaluate(id => {
    const a = window.__filmroom.getProject().annotations.find(x => x.id === id);
    return a.tStart;
  }, backId);

  await page.click('#selTrackBack');
  await page.waitForSelector('#trackPill', { state: 'visible', timeout: 5000 }).catch(() => {});
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 120000 });
  await page.waitForTimeout(300);

  const back = await page.evaluate(id => {
    const a = window.__filmroom.getProject().annotations.find(x => x.id === id);
    const ts = a.keys.map(k => k.t);
    return { tStart: a.tStart, first: Math.min(...ts), last: Math.max(...ts),
             ordered: ts.every((t, i) => i === 0 || t >= ts[i - 1]), keys: ts.length };
  }, backId);

  check('it works back well before the anchor (from ' + beforeStart.toFixed(1) +
    's to ' + back.first.toFixed(1) + 's)', back.first < 2);
  check('the ring becomes visible from where he came from (starts ' +
    back.tStart.toFixed(1) + 's)', back.tStart <= back.first + 0.01);
  check('it does not run past the anchor', back.last <= 6.05);
  check('the path is stored in time order, so the ring glides rather than jumps',
    back.ordered && back.keys > 4);

  for (const t of [2, 4, 5.5]){
    const got = await spotAt(page, backId, t);
    const want = ballA(t);
    const err = Math.hypot(got.x - want.x, got.y - want.y);
    check(`on the ball going backwards at t=${t} (err ${err.toFixed(3)})`, err < 0.03);
  }

  // an anchor at the very start has nothing behind it, and says so
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0.05; });
  await page.waitForTimeout(200);
  await page.evaluate(() => [...document.querySelectorAll('.toast')].forEach(t => t.remove()));
  await page.click('#selTrackBack');
  await page.waitForTimeout(400);
  check('working back from the very start explains itself instead of doing nothing',
    /nothing before this point/i.test(await page.evaluate(() =>
      [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '))));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
