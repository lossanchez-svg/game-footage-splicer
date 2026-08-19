/*
  Progress dashboard: reads every project this browser (and the Games folder)
  knows about and answers "is he getting better?" — headline numbers, a bar per
  game in date order, the labels that come up most, what is changing between his
  early games and his recent ones, filters, and a spreadsheet export.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, OUT, launch } = require('./common');

/* build a project the way the app stores one */
const mkProject = (name, dayOffset, clips) => ({
  version: 1, videoName: name, videoKey: 'filmroom:' + name + ':100',
  videoDate: Date.UTC(2026, 2, 1) + dayOffset * 86400000,
  savedAt: new Date(Date.UTC(2026, 2, 1) + dayOffset * 86400000).toISOString(),
  fps: 30, annotations: [], clips: clips.map((c, i) => ({
    id: name + i, tIn: i, tOut: i + 3, title: c.title || ('Moment ' + i),
    rating: c.rating, tags: c.tags || [], notes: c.notes || '',
    position: c.position || 'Winger', format: c.format || '9v9', ask: '',
  })), sessions: c_sessions(name),
});
function c_sessions(name){
  return name === 'week1.mp4' ? [{ when: '2026-03-02', title: 'Week 1', entries: [], wentWell: [], workOn: '' }] : [];
}

/* six games: heavy touches fade away, scanning appears */
const SEASON = [
  mkProject('week1.mp4', 0, [
    { rating: 'negative', tags: ['Heavy / poor touch'], title: 'Touch got away' },
    { rating: 'negative', tags: ['Heavy / poor touch'] },
    { rating: 'positive', tags: ['Great move (1v1)'] },
  ]),
  mkProject('week2.mp4', 7, [
    { rating: 'negative', tags: ['Heavy / poor touch'] },
    { rating: 'negative', tags: ['Heavy / poor touch'] },
    { rating: 'positive', tags: ['Great move (1v1)'] },
  ]),
  mkProject('week3.mp4', 14, [
    { rating: 'negative', tags: ['Heavy / poor touch'] },
    { rating: 'negative', tags: ['Heavy / poor touch'] },
    { rating: 'neutral', tags: ['High-IQ play'] },
  ]),
  mkProject('week4.mp4', 21, [
    { rating: 'positive', tags: ['Scanned before receiving'] },
    { rating: 'positive', tags: ['Great move (1v1)'] },
  ]),
  mkProject('week5.mp4', 28, [
    { rating: 'positive', tags: ['Scanned before receiving'] },
    { rating: 'positive', tags: ['Great move (1v1)'], position: 'Striker' },
  ]),
  mkProject('week6.mp4', 35, [
    { rating: 'positive', tags: ['Scanned before receiving'],
      notes: 'Head up early, "checks", then plays' },      // commas + quotes for the CSV
    { rating: 'positive', tags: ['Great move (1v1)'] },
  ]),
];

const openDash = async page => {
  await page.click('#btnTrends');
  await page.waitForSelector('#trendModal.open');
  await page.waitForTimeout(300);
};

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  // ---- empty state: says what to do, does not show a chart of nothing ----
  await openDash(page);
  const empty = await page.textContent('#trendBody');
  check('empty state explains how to fill it', /Break down a game/i.test(empty));
  check('empty state names the three markings',
    /Strength/.test(empty) && /Work-on/.test(empty) && /Teachable/.test(empty));
  check('no bars are drawn for no data',
    await page.$$eval('#trendBody .barTrack', els => els.length) === 0);
  await page.click('#trendClose');

  // ---- a season's worth of games ----
  await page.evaluate(season => {
    for (const p of season) localStorage.setItem(p.videoKey, JSON.stringify(p));
  }, SEASON);
  await openDash(page);

  const kpis = await page.$$eval('#trendBody .kpi', els =>
    els.map(e => ({ fig: e.querySelector('.fig').textContent, cap: e.querySelector('.cap').textContent })));
  check('counts every game it knows about (' + kpis[0].fig + ')', kpis[0].fig === '6');
  check('counts every saved moment (' + kpis[1].fig + ')', kpis[1].fig === '15');
  const strengths = SEASON.flatMap(p => p.clips).filter(c => c.rating === 'positive').length;
  check(`shows what share are strengths (${kpis[2].fig}, expected ${Math.round(strengths / 15 * 100)}%)`,
    kpis[2].fig === Math.round(strengths / 15 * 100) + '%');
  check('counts sessions watched together (' + kpis[3].fig + ')', kpis[3].fig === '1');
  check('the headline figures are plain sans, not tabular', await page.evaluate(() => {
    const st = getComputedStyle(document.querySelector('#trendBody .kpi .fig'));
    return !/tabular/.test(st.fontVariantNumeric);
  }));

  // ---- a bar per game, oldest first ----
  const rows = await page.$$eval('#trendBody .trendSection', secs => {
    const s = [...secs].find(x => /Game by game/i.test(x.querySelector('h4').textContent));
    return [...s.querySelectorAll('.barRow')].map(r => ({
      label: r.querySelector('.rowLbl').childNodes[0].textContent.trim(),
      value: r.querySelector('.rowVal').textContent.trim(),
      segs: [...r.querySelectorAll('.seg')].length,
    }));
  });
  check('one bar per game, oldest first (' + rows.map(r => r.label).join(' → ') + ')',
    rows.length === 6 && rows[0].label === 'week1' && rows[5].label === 'week6');
  check('each bar carries its number as text, not only in a tooltip',
    rows.every(r => /^\d+$/.test(r.value)) && rows[0].value === '3');
  check('a game with two kinds of moment is split into segments', rows[0].segs === 2);
  check('segments are separated by a gap in the surface, never a border', await page.evaluate(() => {
    const t = document.querySelector('#trendBody .barTrack');
    const seg = t.querySelector('.seg');
    return getComputedStyle(t).gap === '2px' && getComputedStyle(seg).borderStyle === 'none';
  }));
  check('bars stay thin (' + await page.evaluate(() =>
    document.querySelector('#trendBody .barTrack').getBoundingClientRect().height) + 'px)',
    await page.evaluate(() => document.querySelector('#trendBody .barTrack').getBoundingClientRect().height <= 24));

  // ---- identity never rests on colour alone ----
  check('a legend names each colour', await page.evaluate(() => {
    const t = document.querySelector('#trendBody .legend').textContent;
    return /Strengths/.test(t) && /Work-ons/.test(t) && /Teachable/.test(t);
  }));
  check('and each legend entry carries an icon as well as a swatch',
    /👍/.test(await page.textContent('#trendBody .legend')));

  // ---- what comes up most ----
  const tags = await page.$$eval('#trendBody .trendSection', secs => {
    const s = [...secs].find(x => /comes up most/i.test(x.querySelector('h4').textContent));
    return [...s.querySelectorAll('.barRow')].map(r => r.querySelector('.rowLbl').textContent.trim()
      + '=' + r.querySelector('.rowVal').textContent.trim());
  });
  const counts = tags.map(t => Number(t.split('=').pop()));
  check('ranks the labels used most, biggest first (' + tags.join(', ') + ')',
    tags[0] === 'Heavy / poor touch=6' && tags[1] === 'Great move (1v1)=5' &&
    counts.every((n, i) => i === 0 || n <= counts[i - 1]));

  // ---- the trend that matters ----
  const moving = await page.$$eval('#trendBody .trendItem', els => els.map(e => e.textContent.trim()));
  check('says what is coming up less than it did (' + (moving[0] || '') + ')',
    moving.some(t => /Heavy \/ poor touch/.test(t) && /less often/i.test(t)));
  check('and what is showing up more',
    moving.some(t => /Scanned before receiving/.test(t) && /more often/i.test(t)));
  check('with real per-game numbers, not just an arrow',
    moving.some(t => /about \d/.test(t) && /a game/.test(t)));

  // tall viewport so the whole dashboard, "what is changing" included, is in frame
  await page.setViewportSize({ width: 1180, height: 1180 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, 'trends_dashboard.png') });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(200);

  // ---- filters scope everything at once ----
  await page.selectOption('#trendPosition', 'Striker');
  await page.waitForTimeout(250);
  const strikerKpi = await page.$eval('#trendBody .kpi .fig', e => e.textContent);
  check('filtering by position re-reads every number (' + strikerKpi + ' game)', strikerKpi === '1');
  await page.selectOption('#trendPosition', '');
  await page.waitForTimeout(250);
  check('clearing the filter restores the season',
    await page.$eval('#trendBody .kpi .fig', e => e.textContent) === '6');

  // ---- spreadsheet ----
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('#trendCsv'),
  ]);
  const csvPath = path.join(OUT, 'trends.csv');
  await dl.saveAs(csvPath);
  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.trim().split(/\r?\n/);
  check('spreadsheet is named for what it holds', dl.suggestedFilename().endsWith('.csv'));
  check('one header row plus one row per moment (' + lines.length + ')', lines.length === 16);
  check('header speaks plainly', /Game,Game date,Moment,This is/.test(lines[0]));
  check('ratings are spelled out, not stored as code words',
    /Strength/.test(csv) && !/positive/.test(csv));
  check('a note containing commas and quotes survives intact',
    csv.includes('"Head up early, ""checks"", then plays"'));
  check('game dates are exported in a sortable form', /,2026-03-01,/.test(csv));

  // ---- the dashboard reads work done on another computer, via the Games folder ----
  const folderOnly = mkProject('away-game.mp4', 42, [
    { rating: 'positive', tags: ['Line-breaking pass'] },
  ]);
  await page.evaluate(p => {
    const files = new Map([[p.videoName + '.filmroom.json', JSON.stringify(p)]]);
    window.gameDirStub = {
      queryPermission: async () => 'granted',
      values: async function*(){
        for (const [name, text] of files)
          yield { kind: 'file', name, getFile: async () => new File([text], name) };
      },
    };
    // hand it to the app the way the library would
    window.__filmroom.setGameDir(window.gameDirStub);
  }, folderOnly);
  await page.click('#trendClose');
  await openDash(page);
  const withFolder = await page.$eval('#trendBody .kpi .fig', e => e.textContent);
  check('a game only ever opened on another computer still counts (' + withFolder + ')',
    withFolder === '7');

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
