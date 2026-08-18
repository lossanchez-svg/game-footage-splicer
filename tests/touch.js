/*
  Touch/iPad suite: runs the app in a touch-enabled portrait-tablet context and
  checks the responsive layout plus core tap interactions (tool select, placing
  a spotlight by tapping the video, seeking by tapping the timeline).
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch({
    viewport: { width: 834, height: 1112 },   // iPad Air portrait
    hasTouch: true,
    isMobile: true,
  });

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); });
  await page.reload();

  check('narrow layout stacks sidebar below video',
    await page.evaluate(() => getComputedStyle(document.querySelector('#main')).flexDirection === 'column'));
  check('sidebar spans full width',
    await page.evaluate(() => {
      const sb = document.querySelector('#sidebar');
      return Math.abs(sb.getBoundingClientRect().width - innerWidth) < 2;
    }));

  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);
  check('video loads in touch context', true);

  // tap a tool, then tap the video to place a spotlight
  await page.tap('#toolGrid button[data-tool=spot]');
  check('tool switches by tap',
    await page.evaluate(() => document.querySelector('#toolGrid button[data-tool=spot]').classList.contains('active')));
  const box = await (await page.$('#overlay')).boundingBox();
  await page.touchscreen.tap(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.waitForTimeout(200);
  check('spotlight placed by tap', (await page.textContent('#annCount')).includes('1'));

  // tap the timeline to seek
  const tl = await (await page.$('#timeline')).boundingBox();
  await page.touchscreen.tap(tl.x + tl.width * 0.5, tl.y + tl.height * 0.5);
  await page.waitForTimeout(300);
  const t = await page.evaluate(() => document.querySelector('#video').currentTime);
  check(`timeline tap seeks (t=${t.toFixed(2)})`, t > 3.5 && t < 6.5);

  // tap transport controls
  await page.tap('#btnPlay');
  await page.waitForTimeout(300);
  check('play by tap', await page.evaluate(() => !document.querySelector('#video').paused));
  await page.tap('#btnPlay');

  // tabs by tap
  await page.tap('#tabs button[data-tab=coach]');
  check('coach tab opens by tap', await page.isVisible('#panel-coach'));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
