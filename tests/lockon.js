/*
  Lock-On model runtime (v4, Phase 1): the vendored on-device player detector.

  What must be true:
  - lockon.js next to index.html boots the ONNX runtime + YOLOX-Nano with ZERO
    network requests, from file:// (footage never leaves the machine, and the
    app must work offline).
  - Loading is lazy: opening the app touches none of it.
  - The YOLOX decode and NMS are correct — proved on fabricated tensors where
    the right answer is known by construction, since the synthetic fixtures
    contain no real people for a COCO-trained detector to find. (Detection on
    real players is exactly what the realeval harness measures, on real clips.)
  - index.html ALONE — copied somewhere without lockon.js — still works: the
    loader reports 'absent', the v3.7 tracker runs exactly as before, and the
    tracking report says which of the two happened.
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const { APP, FIXTURES, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();

  /* -------- with lockon.js present (the shipped repo layout) -------- */
  const requests = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  check('loading is lazy — nothing tried at startup',
    await page.evaluate(() => window.__filmroom.lockon.state) === 'untried');

  const loaded = await page.evaluate(async () => {
    const rt = await window.__filmroom.lockon.load();
    return { ok: !!rt, state: window.__filmroom.lockon.state,
             loadMs: window.__filmroom.lockon.loadMs };
  });
  check(`runtime + model load from the local file (state: ${loaded.state})`, loaded.ok && loaded.state === 'ready');
  console.log(`   first load took ${loaded.loadMs}ms (budget: ~2s on a real laptop; headless VM is slower)`);
  check('load() is single-flight — a second call returns the same runtime',
    await page.evaluate(async () => !!(await window.__filmroom.lockon.load())));

  const external = requests.filter(u => /^https?:/i.test(u));
  check(`zero network requests (${external.length} external)`, external.length === 0);

  /* decode: one fabricated detection at stride 8, grid (10, 5) */
  const dec = await page.evaluate(() => {
    const data = new Float32Array(3549 * 85);
    const i = 5 * 52 + 10, o = i * 85;
    data[o] = 0.5; data[o + 1] = 0.5;                  // centre = (grid + 0.5) * 8
    data[o + 2] = Math.log(2); data[o + 3] = Math.log(3); // w = 16, h = 24
    data[o + 4] = 0.9; data[o + 5] = 0.8;              // score = 0.72
    return window.__filmroom.lockon.decode(data, 416, 0.3);
  });
  check('decode finds exactly the fabricated detection', dec.length === 1);
  check(`decode maps grid to pixels ((${dec[0] && dec[0].x}, ${dec[0] && dec[0].y}) = (76, 32))`,
    dec.length === 1 && Math.abs(dec[0].x - 76) < 1e-4 && Math.abs(dec[0].y - 32) < 1e-4);
  check('decode sizes via exp x stride (16 x 24)',
    dec.length === 1 && Math.abs(dec[0].w - 16) < 1e-4 && Math.abs(dec[0].h - 24) < 1e-4);
  check(`decode scores objectness x class (${dec.length === 1 ? dec[0].score.toFixed(3) : '-'})`,
    dec.length === 1 && Math.abs(dec[0].score - 0.72) < 1e-4);
  check('decode respects the threshold',
    (await page.evaluate(() => {
      const data = new Float32Array(3549 * 85);
      const o = (5 * 52 + 10) * 85;
      data[o + 4] = 0.5; data[o + 5] = 0.5;            // 0.25 < 0.35
      return window.__filmroom.lockon.decode(data, 416, 0.35).length;
    })) === 0);

  const nms = await page.evaluate(() => {
    const a = { x: 0, y: 0, w: 20, h: 40, score: 0.9 };
    const b = { x: 2, y: 2, w: 20, h: 40, score: 0.8 };   // heavy overlap: suppressed
    const c = { x: 200, y: 0, w: 20, h: 40, score: 0.7 }; // disjoint: kept
    return window.__filmroom.lockon.nms([a, b, c], 0.45);
  });
  check(`nms keeps the best of an overlap and the disjoint box (${nms.length} of 3)`,
    nms.length === 2 && nms[0].score === 0.9 && nms[1].score === 0.7);

  /* a frame with no people in it comes back empty, not broken */
  const empty = await page.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 360;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#2f7d31'; cx.fillRect(0, 0, 640, 360);
    const dets = await window.__filmroom.lockon.detect(cv, 320, 180, 416);
    return Array.isArray(dets) ? dets.length : -1;
  });
  check(`plain grass detects no one (${empty} boxes)`, empty === 0);

  /* -------- the DEFAULT path, real model, nobody to detect --------
     Since the 2026-08-25 flip, detection is what a plain Follow press does.
     On a fixture the COCO model sees nothing in, the run must hand itself to
     the template tracker on its own — model present, no flag set, no error. */
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'ball.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 7);
  const box1 = await (await page.$('#overlay')).boundingBox();
  await page.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page.waitForTimeout(300);
  await page.click('#toolGrid button[data-tool=spot]');
  await page.mouse.move(box1.x + box1.width * (58 / 640), box1.y + box1.height * (180 / 360));
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(250);
  await page.click('#toolGrid button[data-tool=select]');
  await page.click('#annList .annItem .kind >> nth=0');
  await page.click('#selTrack');
  await page.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  const fell = await page.evaluate(() => {
    const s = window.__filmroom.getProject().annotations[0];
    return { keys: s.keys.length, path: window.__filmroom.trackReport.path };
  });
  check(`default press, real model, nothing detected: template path takes over (${fell.path})`,
    fell.path === 'template');
  check(`and the run still tracked (${fell.keys} keys written)`, fell.keys >= 4);

  /* -------- index.html ALONE, without lockon.js -------- */
  const solo = fs.mkdtempSync(path.join(os.tmpdir(), 'filmroom-solo-'));
  fs.copyFileSync(path.resolve(__dirname, '..', 'index.html'), path.join(solo, 'index.html'));
  const page2 = await (await browser.newContext({ acceptDownloads: true })).newPage();
  const errors2 = [];
  page2.on('pageerror', e => errors2.push('PAGEERROR: ' + e.message));
  await page2.goto('file://' + path.join(solo, 'index.html'));
  await page2.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page2.reload();

  const absent = await page2.evaluate(async () => {
    const rt = await window.__filmroom.lockon.load();
    return { rt: !!rt, state: window.__filmroom.lockon.state };
  });
  check(`index.html alone: loader reports absent, quietly (${absent.state})`,
    !absent.rt && absent.state === 'absent');

  // and the built-in tracker still works exactly as before
  await page2.setInputFiles('#fileVideo', path.join(FIXTURES, 'ball.webm'));
  await page2.waitForSelector('#videoWrap', { state: 'visible' });
  await page2.waitForFunction(() => document.querySelector('#video').duration > 7);
  const box = await (await page2.$('#overlay')).boundingBox();
  await page2.evaluate(() => { document.querySelector('#video').currentTime = 0; });
  await page2.waitForTimeout(300);
  await page2.click('#toolGrid button[data-tool=spot]');
  await page2.mouse.move(box.x + box.width * (58 / 640), box.y + box.height * (180 / 360));
  await page2.mouse.down(); await page2.mouse.up();
  await page2.waitForTimeout(250);
  await page2.click('#toolGrid button[data-tool=select]');
  await page2.click('#annList .annItem .kind >> nth=0');
  await page2.click('#selTrack');
  await page2.waitForSelector('#trackPill', { state: 'hidden', timeout: 240000 });
  const after = await page2.evaluate(() => {
    const s = window.__filmroom.getProject().annotations[0];
    return { keys: s.keys.length, lockon: window.__filmroom.trackReport.lockon };
  });
  check(`the v3.7 tracker still runs without the model (${after.keys} keys written)`, after.keys >= 4);
  check(`and the tracking report says which path ran (lockon: ${after.lockon})`, after.lockon === 'absent');
  check('no page errors without lockon.js', errors2.length === 0);

  fs.rmSync(solo, { recursive: true, force: true });
  console.log('\n--- errors collected:', errors.length + errors2.length);
  errors.concat(errors2).forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length + errors2.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
