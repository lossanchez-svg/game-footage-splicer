/*
  Tactics-board suite: open the board, verify formation seeding, place/drag/
  rename chips, draw an arrow, switch formats, attach a board to a clip,
  export PNG, and persist through reload.
*/
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  const boards = () => page.evaluate(() => window.__filmroom.getProject().boards || []);

  // open the board — first board auto-created with a 9v9 lineup
  await page.click('#btnBoard');
  await page.waitForSelector('#boardWrap', { state: 'visible' });
  check('board opens, video hidden', !(await page.isVisible('#videoWrap')));
  let b = (await boards())[0];
  check('board auto-created', !!b && b.format === '9v9');
  check(`9v9 seeds 18 chips (${b.items.filter(i => i.type === 'chip').length})`,
    b.items.filter(i => i.type === 'chip').length === 18);

  const box = await (await page.$('#boardCanvas')).boundingBox();
  const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

  // place a new chip with the spotlight tool
  await page.click('#toolGrid button[data-tool=spot]');
  await page.fill('#labelInput', 'Marco');
  let p = at(0.5, 0.3);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(150);
  b = (await boards())[0];
  const marco = b.items.find(i => i.type === 'chip' && i.label === 'Marco');
  check('chip placed with label', !!marco && Math.abs(marco.x - 0.5) < 0.03 && Math.abs(marco.y - 0.3) < 0.03);

  // drag it with select
  await page.click('#toolGrid button[data-tool=select]');
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  const q = at(0.6, 0.6);
  await page.mouse.move(q.x, q.y, { steps: 6 }); await page.mouse.up();
  await page.waitForTimeout(150);
  b = (await boards())[0];
  const moved = b.items.find(i => i.label === 'Marco');
  check(`chip drags (${moved.x.toFixed(2)}, ${moved.y.toFixed(2)})`,
    Math.abs(moved.x - 0.6) < 0.04 && Math.abs(moved.y - 0.6) < 0.04);

  // rename by double-click
  page.once('dialog', d => d.accept('M10'));
  await page.mouse.dblclick(q.x, q.y);
  await page.waitForTimeout(150);
  b = (await boards())[0];
  check('chip renamed via double-click', b.items.some(i => i.label === 'M10'));

  // arrow on the board
  await page.click('#toolGrid button[data-tool=arrow]');
  p = at(0.2, 0.8);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(at(0.45, 0.7).x, at(0.45, 0.7).y, { steps: 5 }); await page.mouse.up();
  await page.waitForTimeout(150);
  b = (await boards())[0];
  check('arrow drawn on board', b.items.some(i => i.type === 'arrow'));

  // format switch + line up
  await page.selectOption('#boardFormat', '7v7');
  await page.click('#boardReset');
  await page.waitForTimeout(150);
  b = (await boards())[0];
  check(`7v7 line-up reseeds 14 chips (${b.items.filter(i => i.type === 'chip').length})`,
    b.items.filter(i => i.type === 'chip').length === 14);
  check('line-up keeps drawings', b.items.some(i => i.type === 'arrow'));

  // PNG export
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 10000 }),
    page.click('#boardPng'),
  ]);
  check('board exports PNG', dl.suggestedFilename().endsWith('.png'));

  // close → video back
  await page.click('#boardClose');
  check('closing board restores video', await page.isVisible('#videoWrap'));

  // clip-linked board
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Switch point');
  await page.click('#clipSave');
  await page.waitForTimeout(200);
  await page.click('#clipList [data-act=board]');
  await page.waitForSelector('#boardWrap', { state: 'visible' });
  const all = await boards();
  check(`clip button creates + opens linked board (${all.length} boards)`, all.length === 2 &&
    all.some(x => x.name.includes('Switch point')));
  check('clip records its boardId', await page.evaluate(() =>
    !!window.__filmroom.getProject().clips[0].boardId));
  await page.click('#boardClose');

  // persistence
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(400);
  const restored = await boards();
  check('boards persist through reload', restored.length === 2 &&
    restored[0].items.some(i => i.label === 'M10' || i.type === 'arrow'));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
