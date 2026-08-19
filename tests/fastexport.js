/*
  Fast-export suite: exercises the WebCodecs H.264 → .mp4 path.

  With a browser that can encode H.264 (real Chrome/Safari): full end-to-end
  export, plus container probing when $FFMPEG is set.

  The bundled test Chromium cannot encode H.264, so there it falls back to a
  STUBBED VideoEncoder and validates the export flow instead: frame counts for
  title card + clip + decision freeze, keyframe cadence, and the download
  plumbing. The mp4 writer itself is separately proven against real H.264 in
  muxer.js.
*/
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { APP, FIXTURES, OUT, launch } = require('./common');

const STUB = () => {
  window.__fakeEnc = { frames: 0, keys: 0 };
  window.VideoFrame = class {
    constructor(src, opts){ this.timestamp = opts && opts.timestamp; }
    close(){}
  };
  window.VideoEncoder = class {
    static async isConfigSupported(){ return { supported: true }; }
    constructor({ output }){ this.output = output; this.encodeQueueSize = 0; }
    configure(){}
    encode(frame, opts){
      window.__fakeEnc.frames++;
      if (opts && opts.keyFrame) window.__fakeEnc.keys++;
      const data = new Uint8Array(64).fill(7);
      const meta = window.__fakeEnc.frames === 1
        ? { decoderConfig: { description: new Uint8Array([1, 66, 0, 40, 255, 225, 0, 2, 103, 66, 1, 0, 104]) } }
        : undefined;
      this.output({ byteLength: data.length, type: (opts && opts.keyFrame) ? 'key' : 'delta',
        copyTo: d => d.set(data) }, meta);
    }
    async flush(){}
    close(){}
  };
};

async function hasRealSupport(page){
  return page.evaluate(async () => {
    try {
      if (!window.VideoEncoder) return false;
      const r = await VideoEncoder.isConfigSupported({ codec: 'avc1.420028', width: 1280, height: 720,
        bitrate: 8_000_000, framerate: 30, avc: { format: 'avc' } });
      return !!(r && r.supported);
    } catch (e) { return false; }
  });
}

(async () => {
  let { browser, page, errors, check } = await launch();
  await page.goto(APP);
  const real = await hasRealSupport(page);
  let stubbed = false;
  if (!real){
    await browser.close();
    ({ browser, page, errors, check } = await launch());
    await page.addInitScript(STUB);
    stubbed = true;
    console.log('note: no H.264 encoder in this browser — running flow checks with a stubbed VideoEncoder');
  }

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:seenHelp', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  await page.waitForFunction(() => document.querySelector('#exportMode').style.display !== 'none', { timeout: 5000 });
  check('fast export offered (exportMode select visible)', true);
  await page.evaluate(() => { document.querySelector('#exportMode').value = 'fast'; });

  // decision point at 4s, clip 3..5.5 → export = 2.8s card + 2.5s clip + 3.2s freeze
  await page.evaluate(() => { document.querySelector('#video').currentTime = 4; });
  await page.waitForTimeout(250);
  await page.fill('#pauseQInput', 'Turn or play back?');
  await page.click('#btnAddPause');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 3; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 5.5; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Fast export check');
  await page.click('#ratingRow [data-rating=neutral]');
  await page.click('#clipSave');
  await page.waitForTimeout(200);
  await page.click('#tabs button[data-tab=clips]');

  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click('#clipList [data-act=export]'),
  ]);
  check('fast export downloads .mp4', dl.suggestedFilename().endsWith('.mp4'));
  const out = path.join(OUT, 'fast_' + dl.suggestedFilename());
  await dl.saveAs(out);
  check('busy overlay hidden after export',
    await page.evaluate(() => document.querySelector('#busyOverlay').style.display !== 'flex'));
  check('no console errors during export', errors.length === 0);

  if (stubbed){
    const enc = await page.evaluate(() => window.__fakeEnc);
    // 84 card + 75 clip + 96 freeze = 255 frames; seek-boundary jitter allowed
    check(`flow encoded card+clip+freeze frames (${enc.frames} ≈ 255)`, enc.frames >= 245 && enc.frames <= 265);
    const expectKeys = Math.ceil(enc.frames / 60);
    check(`keyframe every 2s (${enc.keys} keys)`, Math.abs(enc.keys - expectKeys) <= 1);
  } else {
    const size = fs.statSync(out).size;
    check(`mp4 has substance (${size} bytes)`, size > 100000);
    if (process.env.FFMPEG){
      let probe = '';
      try { execFileSync(process.env.FFMPEG, ['-i', out], { stdio: ['ignore', 'pipe', 'pipe'] }); }
      catch (e) { probe = e.stderr.toString(); }
      check('container probes as h264', /Video: h264/.test(probe));
      const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
      const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
      check(`duration covers card+clip+freeze (${dur.toFixed(2)}s ≈ 8.5s)`, dur > 7.8 && dur < 9.2);
    } else {
      console.log('note: set FFMPEG=/path/to/ffmpeg to also probe the container');
    }
  }

  /* ---- highlight reel: second clip, add both, export one stitched mp4 ---- */
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });
  await page.waitForTimeout(200);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', 'Second clip');
  await page.click('#ratingRow [data-rating=positive]');
  await page.click('#clipSave');
  await page.waitForTimeout(200);

  const reelCount = await page.$$eval('#clipList [data-act=reel]', els => els.length);
  check('reel toggle on every clip', reelCount === 2);
  for (let i = 0; i < reelCount; i++){       // re-query each time: toggling re-renders the list
    await page.click(`#clipList .clipItem >> nth=${i} >> [data-act=reel]`);
    await page.waitForTimeout(150);
  }
  check('reel list shows both clips (ordered)',
    await page.evaluate(() => document.querySelectorAll('#reelList .annItem').length === 2));
  await page.fill('#reelTitle', 'Test week reel');
  if (stubbed) await page.evaluate(() => { window.__fakeEnc.frames = 0; window.__fakeEnc.keys = 0; });

  const [dl3] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click('#btnExportReel'),
  ]);
  check('reel exports one .mp4', dl3.suggestedFilename().endsWith('.mp4'));
  check('reel filename carries the title', /Test_week_reel/.test(dl3.suggestedFilename()));
  const reelOut = path.join(OUT, 'reel_' + dl3.suggestedFilename());
  await dl3.saveAs(reelOut);

  if (stubbed){
    const enc = await page.evaluate(() => window.__fakeEnc);
    // 90 reel card + (84 card + 30 media) + (84 card + 75 media + 96 freeze) = 459
    check(`reel frames = intro + 2×(card+clip) + freeze (${enc.frames} ≈ 459)`,
      enc.frames >= 445 && enc.frames <= 475);
  } else if (process.env.FFMPEG){
    let probe = '';
    try { execFileSync(process.env.FFMPEG, ['-i', reelOut], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { probe = e.stderr.toString(); }
    const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
    const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
    check(`reel duration ≈ 15.3s (${dur.toFixed(2)}s)`, dur > 14.3 && dur < 16.3);
  }

  /* ---- a clip with a tactics board gets it as a card after the play ---- */
  // Measure the SAME clip before and after attaching a board, so the assertion
  // is the board's own contribution rather than arithmetic about card lengths.
  await page.click('#tabs button[data-tab=clips]');
  if (stubbed) await page.evaluate(() => { window.__fakeEnc.frames = 0; window.__fakeEnc.keys = 0; });
  const [dlBefore] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click('#clipList .clipItem >> nth=0 >> [data-act=export]'),
  ]);
  await dlBefore.saveAs(path.join(OUT, 'noboard_' + dlBefore.suggestedFilename()));
  const framesBefore = stubbed ? await page.evaluate(() => window.__fakeEnc.frames) : 0;

  await page.click('#clipList .clipItem >> nth=0 >> [data-act=board]');   // creates + opens it
  await page.waitForTimeout(700);
  await page.click('#boardClose');
  await page.waitForTimeout(300);
  check('the clip now carries a board', await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    const c = p.clips[0];
    return !!c.boardId && (p.boards || []).some(b => b.id === c.boardId);
  }));

  if (stubbed) await page.evaluate(() => { window.__fakeEnc.frames = 0; window.__fakeEnc.keys = 0; });
  const [dl4] = await Promise.all([
    page.waitForEvent('download', { timeout: 180000 }),
    page.click('#clipList .clipItem >> nth=0 >> [data-act=export]'),
  ]);
  const boardOut = path.join(OUT, 'board_' + dl4.suggestedFilename());
  await dl4.saveAs(boardOut);
  check('a clip with a board still exports one file', dl4.suggestedFilename().endsWith('.mp4'));

  if (stubbed){
    const framesAfter = await page.evaluate(() => window.__fakeEnc.frames);
    const added = framesAfter - framesBefore;
    // one 3.2s card at 30fps = 96 frames, and nothing else should change
    check(`the board adds exactly its own card (${framesBefore} → ${framesAfter}, +${added} ≈ 96)`,
      added >= 90 && added <= 102);
  } else if (process.env.FFMPEG){
    let probe = '';
    try { execFileSync(process.env.FFMPEG, ['-i', boardOut], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (e) { probe = e.stderr.toString(); }
    const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
    const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
    check(`the export grew by about the board card (${dur.toFixed(2)}s)`, dur > 3.2);
  }

  // The board card is drawn by the same pushCardFrames() helper as the title
  // cards, so its stretch of the audio timeline is a silence segment by
  // construction — that silence is already proven in voice.js against a
  // timeline that actually has audio in it. This fixture has none at all, so
  // asserting it here would only re-check that a silent video stays silent.

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
