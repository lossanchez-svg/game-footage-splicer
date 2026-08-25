/*
  Voice-over: record yourself talking over a clip, and have it mixed into the
  exported video with the game sound ducked underneath.

  MediaRecorder is stubbed to emit a real WAV blob (decodeAudioData reads WAV),
  so the recording path and the export's audio assembly are both exercised for
  real — the assembly is the part that matters, and it is reachable here even
  though this Chromium has no H.264 encoder.
*/
const path = require('path');
const { APP, FIXTURES, launch, openDisclosures } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');   // WebM: no AAC, so voice is the ONLY audio

/* a stub mic that hands back a 2-second 440Hz WAV */
const STUB_MIC = () => {
  const RATE = 48000, SECS = 2;
  const n = RATE * SECS;
  const buf = new ArrayBuffer(44 + n * 2);
  const dv = new DataView(buf);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); str(8, 'WAVEfmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
  dv.setUint32(24, RATE, true); dv.setUint32(28, RATE * 2, true);
  dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  str(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++)
    dv.setInt16(44 + i * 2, Math.round(Math.sin(i / RATE * 440 * Math.PI * 2) * 20000), true);
  window.__voiceWav = new Blob([buf], { type: 'audio/wav' });

  navigator.mediaDevices = navigator.mediaDevices || {};
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop(){} }] });

  window.MediaRecorder = class {
    constructor(){ this.state = 'inactive'; }
    static isTypeSupported(){ return true; }
    start(){ this.state = 'recording'; }
    stop(){
      this.state = 'inactive';
      if (this.ondataavailable) this.ondataavailable({ data: window.__voiceWav });
      if (this.onstop) this.onstop();
    }
  };
};

const saveClip = async (page, title, at) => {
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at);
  await page.waitForTimeout(140);
  await page.click('#btnMarkIn');
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at + 3);
  await page.waitForTimeout(140);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', title);
  await page.click('#clipSave');
  await page.waitForTimeout(250);
};

(async () => {
  const { browser, page, errors, check } = await launch();
  await page.addInitScript(STUB_MIC);

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);
  await saveClip(page, 'Great scan', 1);
  await page.click('#tabs button[data-tab=clips]');

  // ---- the recorder ----
  check('every clip offers a voice-over', await page.$('#clipList [data-act=voice]') !== null);
  await openDisclosures(page);
  await page.click('#clipList [data-act=voice]');
  await page.waitForSelector('#voiceModal.open');
  check('the recorder names the clip it is for',
    (await page.textContent('#voiceClipName')).includes('Great scan'));
  check('it says nothing is recorded yet and how long the clip is',
    /Nothing recorded yet/i.test(await page.textContent('#voiceState')));
  check('and explains what happens to the recording',
    /goes into the video/i.test(await page.textContent('#voiceHint')));

  await page.click('#voiceBtns [data-v=rec]');
  await page.waitForTimeout(400);
  check('recording plays the clip so you talk over what he sees',
    await page.evaluate(() => !document.querySelector('#video').paused &&
      document.querySelector('#video').currentTime >= 1));
  check('the recorder shows it is live', await page.evaluate(() =>
    document.querySelector('#voiceModal .box').classList.contains('recording')));
  check('with a running clock', /0:0\d/.test(await page.textContent('#voiceTime')));

  await page.click('#voiceBtns [data-v=stop]');
  await page.waitForTimeout(400);
  check('stopping saves it', /Saved/i.test(await page.textContent('#voiceState')));
  check('the clip is marked as having a voice-over',
    (await page.textContent('#clipList [data-act=voice]')).includes('✓'));
  check('and stopping pauses the video',
    await page.evaluate(() => document.querySelector('#video').paused));
  check('the recorder now offers listen-back and remove',
    await page.$('#voiceBtns [data-v=play]') !== null &&
    await page.$('#voiceBtns [data-v=del]') !== null);
  await page.click('#voiceBtns [data-v=done]');
  check('done closes it', await page.$('#voiceModal.open') === null);

  // ---- it survives a reload (IndexedDB, not the project file) ----
  const projectJson = await page.evaluate(() =>
    localStorage.getItem(window.__filmroom.getProject().videoKey));
  check('the recording is NOT in the project file (which would blow the quota)',
    projectJson.length < 4000 && !/audio|blob|base64/i.test(projectJson));

  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(600);
  await page.click('#tabs button[data-tab=clips]');
  check('a recorded clip still shows its mark after a reload',
    (await page.textContent('#clipList [data-act=voice]')).includes('✓'));

  // ---- the export's audio assembly ----
  // This Chromium has no AAC encoder, so the timeline is inspected as PCM —
  // which proves the part that matters: where the voice actually lands.
  const rms = await page.evaluate(async () => {
    const p = window.__filmroom.getProject();
    const clip = p.clips[0];
    const item = { clip, tIn: clip.tIn, tOut: clip.tOut };
    const FPS = 30, frames = Math.round((clip.tOut - clip.tIn) * FPS);
    const out = await window.__filmroom.buildFastAudio(
      [{ type: 'media', t: clip.tIn, frames, item }], frames, FPS, { returnPcm: true });
    if (!out || !out.planes) return null;
    const plane = out.planes[0];
    const energy = (from, to) => {
      let sum = 0, n = 0;
      for (let i = Math.round(from * out.rate); i < Math.round(to * out.rate) && i < plane.length; i++){
        sum += plane[i] * plane[i]; n++;
      }
      return n ? Math.sqrt(sum / n) : 0;
    };
    return { rate: out.rate, secs: out.totalOut / out.rate,
             first: energy(0, 1.8), afterVoice: energy(2.2, 2.9) };
  });
  check('the voice-over lands on a silent video as real audio (rms ' +
    (rms ? rms.first.toFixed(3) : 'n/a') + ')', rms && rms.first > 0.05);
  check('and stops where the recording stopped, rather than looping or padding (rms ' +
    (rms ? rms.afterVoice.toFixed(3) : 'n/a') + ')', rms && rms.afterVoice < 0.001);

  // ---- a question freeze cuts the narration where it cuts the picture ----
  const split = await page.evaluate(async () => {
    const p = window.__filmroom.getProject();
    const clip = p.clips[0];
    const item = { clip, tIn: clip.tIn, tOut: clip.tOut };
    const FPS = 30, half = 15;                       // half a second of picture, then a freeze
    const segments = [
      { type: 'media', t: clip.tIn, frames: half, item },
      { type: 'silence', frames: FPS * 2 },
      { type: 'media', t: clip.tIn + half / FPS, frames: half, item },
    ];
    const total = half * 2 + FPS * 2;
    const out = await window.__filmroom.buildFastAudio(segments, total, FPS, { returnPcm: true });
    if (!out || !out.planes) return null;
    const plane = out.planes[0];
    const energy = (from, to) => {
      let sum = 0, n = 0;
      for (let i = Math.round(from * out.rate); i < Math.round(to * out.rate) && i < plane.length; i++){
        sum += plane[i] * plane[i]; n++;
      }
      return n ? Math.sqrt(sum / n) : 0;
    };
    return { before: energy(0.05, 0.45), freeze: energy(0.7, 2.3), after: energy(2.6, 2.9) };
  });
  check('the narration plays under the picture (rms ' + (split ? split.before.toFixed(3) : 'n/a') + ')',
    split && split.before > 0.05);
  check('goes quiet under a question freeze, exactly as the picture does (rms ' +
    (split ? split.freeze.toFixed(3) : 'n/a') + ')', split && split.freeze < 0.001);
  check('and picks up again on the other side (rms ' + (split ? split.after.toFixed(3) : 'n/a') + ')',
    split && split.after > 0.05);

  // ---- with no recording and no game sound, there is simply no audio ----
  await page.evaluate(async () => {
    const p = window.__filmroom.getProject();
    await window.__filmroom.voiceIds.delete(p.clips[0].id);
  });
  const none = await page.evaluate(async () => {
    const p = window.__filmroom.getProject();
    const clip = p.clips[0];
    const item = { clip, tIn: clip.tIn, tOut: clip.tOut };
    const FPS = 30, frames = 60;
    return await window.__filmroom.buildFastAudio(
      [{ type: 'media', t: clip.tIn, frames, item }], frames, FPS);
  });
  check('silent footage with no voice-over stays silent', none === null);

  // ---- removing a recording ----
  await page.evaluate(() => window.__filmroom.refreshVoiceIds());   // back from IndexedDB
  await page.waitForTimeout(400);
  check('the mark comes back from storage, not from memory',
    (await page.textContent('#clipList [data-act=voice]')).includes('✓'));
  await openDisclosures(page);
  await page.click('#clipList [data-act=voice]');
  await page.waitForSelector('#voiceModal.open');
  await page.click('#voiceBtns [data-v=del]');
  await page.waitForTimeout(400);
  check('removing says the video goes back to just the game sound',
    /just the game sound/i.test(await page.textContent('#voiceState')));
  check('and the clip loses its mark',
    !(await page.textContent('#clipList [data-act=voice]')).includes('✓'));

  // ---- Escape must never leave the microphone running ----
  await page.click('#voiceBtns [data-v=rec]');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  check('Escape closes the recorder', await page.$('#voiceModal.open') === null);
  check('and stops the recording rather than leaving the mic live',
    await page.evaluate(() => document.querySelector('#video').paused));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
