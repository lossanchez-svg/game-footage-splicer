/*
  Session insights: what he SAID, read across sessions. The flagship is
  "asked before / sees it now" — the same question answered in two different
  sessions, shown in order, which is his game-reading changing in his own words.
*/
const path = require('path');
const { APP, OUT, launch } = require('./common');

const Q_SCAN = 'What did he do before the ball got to him?';
const Q_SPACE = 'Where was the space?';

const game = (name, day, clips, sessions) => ({
  version: 1, videoName: name, videoKey: 'filmroom:' + name + ':100',
  videoDate: Date.UTC(2026, 2, 1) + day * 86400000,
  savedAt: new Date(Date.UTC(2026, 2, 1) + day * 86400000).toISOString(),
  annotations: [], clips, sessions,
});
const clip = (id, rating, position) => ({
  id, tIn: 0, tOut: 3, title: 'Moment ' + id, rating, tags: ['Scanned before receiving'],
  notes: '', position: position || 'Winger', format: '9v9', ask: Q_SCAN,
});

/* two sessions, weeks apart, asking the same question — plus a striker-only
   clip so the position filter has something to bite on */
const SEASON = [
  game('week1.mp4', 0, [clip('a', 'negative'), clip('b', 'neutral')], [{
    when: '2026-03-02', title: 'Week 1',
    entries: [
      { clipId: 'a', title: 'Moment a', question: Q_SCAN, answer: 'i dunno i just passed it' },
      { clipId: 'b', title: 'Moment b', question: Q_SPACE, answer: '' },
    ],
    wentWell: ['kept going after losing it'], workOn: 'first touch toward space',
  }]),
  game('week2.mp4', 21, [clip('c', 'positive'), clip('d', 'positive', 'Striker')], [{
    when: '2026-03-22', title: 'Week 4',
    entries: [
      { clipId: 'c', title: 'Moment c', question: Q_SCAN,
        answer: 'i looked over my shoulder first so i knew the 9 was open' },
      { clipId: 'd', title: 'Moment d', question: Q_SPACE, answer: 'behind their left back' },
    ],
    wentWell: ['scanned twice before receiving'], workOn: 'first touch toward space',
  }]),
];

const openDash = async page => {
  await page.click('#btnTrends');
  await page.waitForSelector('#trendModal.open');
  await page.waitForTimeout(300);
};
const section = (page, heading) => page.evaluate(h => {
  const s = [...document.querySelectorAll('#trendBody .trendSection')]
    .find(x => new RegExp(h, 'i').test(x.querySelector('h4').textContent));
  return s ? s.textContent : '';
}, heading);

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  // ---- nothing said yet ----
  await page.evaluate(g => localStorage.setItem(g.videoKey, JSON.stringify(g)),
    game('solo.mp4', 0, [clip('x', 'positive')], []));
  await openDash(page);
  const none = await section(page, 'In his own words');
  check('with no sessions it points at the button that starts one', /Watch together/.test(none));
  check('and does not pretend to have insights', !/most recent/i.test(none));
  await page.click('#trendClose');

  // ---- a season with two sessions ----
  await page.evaluate(season => {
    localStorage.removeItem('filmroom:solo.mp4:100');
    for (const g of season) localStorage.setItem(g.videoKey, JSON.stringify(g));
  }, SEASON);
  await openDash(page);

  const said = await section(page, 'In his own words');
  check('counts what he was asked and what he wrote down', /asked 4 questions/i.test(said));
  check('and says the unwritten ones were talked out loud, not lost',
    /talked out loud/i.test(said) && /not lost/i.test(said));

  // the flagship: same question, both answers, in order
  const groups = await page.$$eval('#trendBody .qGroup', els => els.map(e => ({
    q: e.querySelector('.qText').textContent.trim(),
    lines: [...e.querySelectorAll('.said')].map(s => ({
      when: s.querySelector('.when').textContent.trim(),
      words: s.querySelector('.words').textContent.trim(),
      latest: s.classList.contains('latest'),
    })),
  })));
  const scan = groups.find(g => /before the ball/i.test(g.q));
  check('the repeated question is grouped', !!scan);
  check('both of his answers are shown (' + (scan ? scan.lines.length : 0) + ')',
    scan && scan.lines.length === 2);
  check('oldest first, so it reads as a change over time',
    scan && /i dunno/i.test(scan.lines[0].words) && /over my shoulder/i.test(scan.lines[1].words));
  check('the newest answer is marked as the most recent',
    scan && !scan.lines[0].latest && scan.lines[1].latest &&
    /most recent/i.test(scan.lines[1].words));
  check('each answer carries its date', scan && /Mar/.test(scan.lines[0].when));
  check('a question answered only once is not dressed up as a trend',
    !groups.some(g => /Where was the space/i.test(g.q) && g.lines.length < 2));

  // ---- the work-on thread ----
  const workOn = await section(page, 'What you said to work on');
  check('lists what each session ended on', /first touch toward space/.test(workOn));
  check('newest first', await page.evaluate(() => {
    const s = [...document.querySelectorAll('#trendBody .trendSection')]
      .find(x => /work on/i.test(x.querySelector('h4').textContent));
    const items = [...s.querySelectorAll('.trendItem')].map(i => i.textContent);
    return /Mar 22/.test(items[0]) && /Mar 2\b/.test(items[1]);
  }));
  check('and says why a repeat matters', /Repeats are the point/i.test(workOn));
  check('what went well rides along', /scanned twice before receiving/i.test(workOn));

  await page.setViewportSize({ width: 1180, height: 1400 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'insights.png') });
  await page.setViewportSize({ width: 1280, height: 720 });

  // ---- his words are escaped, never injected ----
  await page.click('#trendClose');
  await page.evaluate(() => {
    const g = JSON.parse(localStorage.getItem('filmroom:week2.mp4:100'));
    g.sessions[0].entries[0].answer = '<img src=x onerror="window.__pwned=1">';
    localStorage.setItem('filmroom:week2.mp4:100', JSON.stringify(g));
  });
  await openDash(page);
  check('an answer containing markup is shown as text, never run',
    await page.evaluate(() => !window.__pwned &&
      document.body.innerHTML.includes('&lt;img src=x')));

  // ---- the filter scopes his answers too ----
  await page.selectOption('#trendPosition', 'Striker');
  await page.waitForTimeout(250);
  const filtered = await section(page, 'In his own words');
  check('filtering to one position narrows what he was asked (' +
    (filtered.match(/asked (\d+) question/) || [])[1] + ')',
    /asked 1 question/i.test(filtered));
  await page.selectOption('#trendPosition', '');
  await page.waitForTimeout(250);
  check('clearing it brings the rest back', /asked 4 questions/i.test(await section(page, 'In his own words')));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
