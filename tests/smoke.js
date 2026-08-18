const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, OUT, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // first-run help modal should appear; close it
  await page.waitForSelector('#helpModal.open', { timeout: 3000 }).catch(() => {});
  check('help modal auto-opens on first run', await page.$('#helpModal.open') !== null);
  await page.click('#helpClose');

  // an empty drop (e.g. dragging out of Apple Photos delivers no file) must explain itself
  await page.evaluate(() => {
    document.dispatchEvent(new DragEvent('drop', { dataTransfer: new DataTransfer(), cancelable: true }));
  });
  await page.waitForTimeout(200);
  const dropToast = await page.evaluate(() =>
    [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));
  check('empty drop shows Photos-app guidance', dropToast.includes('Photos app'));

  // load video
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);
  check('video loads (duration ~10s)', true);

  const box = await (await page.$('#overlay')).boundingBox();
  const at = (fx, fy) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy });

  // spotlight
  await page.click('#toolGrid button[data-tool=spot]');
  await page.fill('#labelInput', 'Marco');
  let p = at(0.5, 0.5);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.up();
  check('spotlight created', (await page.textContent('#annCount')).includes('1'));

  // arrow (drag)
  await page.click('#toolGrid button[data-tool=arrow]');
  await page.click('#arrowStyleRow [data-astyle=run]');
  p = at(0.3, 0.6); const q = at(0.7, 0.3);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(q.x, q.y, { steps: 5 }); await page.mouse.up();
  check('arrow created', (await page.textContent('#annCount')).includes('2'));

  // zone
  await page.click('#toolGrid button[data-tool=zone]');
  p = at(0.6, 0.6);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(at(0.85, 0.85).x, at(0.85, 0.85).y, { steps: 4 }); await page.mouse.up();
  check('zone created', (await page.textContent('#annCount')).includes('3'));

  // text (prompt dialog)
  page.once('dialog', d => d.accept('First touch here'));
  await page.click('#toolGrid button[data-tool=text]');
  p = at(0.2, 0.2);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(200);
  check('text created', (await page.textContent('#annCount')).includes('4'));

  // spotlight keyframe tracking: select, seek to 2s, drag the ring
  await page.click('#toolGrid button[data-tool=select]');
  // select spotlight via its list item
  await page.click('#annList .annItem .kind >> nth=0'); // sorted by time; spot was first at t=0
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });
  await page.waitForTimeout(300);
  p = at(0.5, 0.5);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  await page.mouse.move(at(0.65, 0.4).x, at(0.65, 0.4).y, { steps: 6 }); await page.mouse.up();
  check('spot keyframe drag no errors', errors.length === 0);

  // ring size (spot still selected)
  const r1 = await page.evaluate(() => window.__filmroom.getProject().annotations.find(a => a.type === 'spot').r || 0.035);
  await page.click('#selSizeDown');
  const r2 = await page.evaluate(() => window.__filmroom.getProject().annotations.find(a => a.type === 'spot').r);
  check(`ring size shrinks (${r1} -> ${r2})`, r2 < r1);

  // decision point at t=4
  await page.evaluate(() => { document.querySelector('#video').currentTime = 4; });
  await page.waitForTimeout(200);
  await page.fill('#pauseQInput', 'Where is the open space?');
  await page.click('#btnAddPause');
  check('decision point added', (await page.textContent('#annCount')).includes('5'));

  // clip: in at 1, out at 3, save with tags
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 3; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Great scan then pass');
  await page.click('#ratingRow [data-rating=positive]');

  // vocabulary editing: rename a tag, add a custom one
  await page.click('#btnEditTags');
  await page.waitForSelector('#tagModal.open');
  page.once('dialog', d => d.accept('Sombrero'));
  await page.click('#tagEditor .chip:has-text("Great move (1v1)")');
  await page.waitForTimeout(150);
  page.once('dialog', d => d.accept('Coach special'));
  await page.click('#tagEditor .tagGroup >> nth=0 >> button:has-text("＋ add")');
  await page.waitForTimeout(150);
  await page.click('#tagDone');
  await page.waitForTimeout(150);
  const pickerHtml = await page.textContent('#tagGroups');
  check('tag renamed in picker', pickerHtml.includes('Sombrero') && !pickerHtml.includes('Great move (1v1)'));
  check('custom tag added', pickerHtml.includes('Coach special'));
  await page.click('#tagGroups .chip:has-text("High-IQ play")');
  await page.click('#tagGroups .chip:has-text("Scanned before receiving")');
  await page.click('#clipSave');
  await page.waitForTimeout(200);
  check('clip saved & listed', (await page.textContent('#clipList')).includes('Great scan then pass'));
  check('clip tab shows tags', (await page.textContent('#clipList')).includes('High-IQ play'));

  // decision overlay fires during playback (pause point at t=4)
  await page.evaluate(() => { const v = document.querySelector('#video'); v.currentTime = 3.5; });
  await page.waitForTimeout(200);
  await page.click('#btnPlay');
  await page.waitForSelector('#decisionOverlay', { state: 'visible', timeout: 5000 })
    .then(() => check('decision overlay fired', true))
    .catch(() => check('decision overlay fired', false));
  check('overlay question shown', (await page.textContent('#decisionQ')).includes('open space'));
  await page.click('#btnResume');
  await page.waitForTimeout(300);
  check('resumed playing', await page.evaluate(() => !document.querySelector('#video').paused));
  await page.evaluate(() => document.querySelector('#video').pause());

  // clip loop playback
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#clipList [data-act=play]');
  await page.waitForTimeout(400);
  check('clip playback started', await page.evaluate(() => {
    const v = document.querySelector('#video'); return !v.paused && v.currentTime >= 0.9; }));
  await page.click('#btnStopLoop');
  await page.evaluate(() => document.querySelector('#video').pause());

  // snapshot download
  const [dl1] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#btnSnapshot')]);
  check('snapshot downloads png', dl1.suggestedFilename().endsWith('.png'));

  // export clip via the REALTIME path (fast path has its own suite: fastexport.js)
  await page.evaluate(() => {
    const s = document.querySelector('#exportMode');
    if (s) s.value = 'realtime';
  });
  const [dl2] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.click('#clipList [data-act=export]'),
  ]);
  const out = path.join(OUT, 'export_' + dl2.suggestedFilename());
  await dl2.saveAs(out);
  const size = fs.statSync(out).size;
  check('export produced video file (' + dl2.suggestedFilename() + ', ' + size + ' bytes)', size > 20000);
  check('busy overlay hidden after export', await page.evaluate(() => document.querySelector('#busyOverlay').style.display !== 'flex'));

  // undo pops the last mutation — the clip save — then re-save it so the
  // autosave-restore section below has a clip to find
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(150);
  check('undo removes the last change (the saved clip)',
    !(await page.textContent('#clipList')).includes('Great scan then pass'));
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 3; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Great scan then pass');
  await page.click('#clipSave');
  await page.waitForTimeout(200);

  // autosave restore: reload and re-open same file
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(400);
  const annCount = await page.textContent('#annCount');
  const clipHtml = await page.textContent('#clipList');
  check('autosave restored drawings (' + annCount + ')', /\d/.test(annCount));
  check('autosave restored clips', clipHtml.includes('Great scan then pass'));

  // keyboard: frame step + speed
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('BracketLeft');
  check('speed changed to 0.75', await page.evaluate(() => document.querySelector('#video').playbackRate === 0.75));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
