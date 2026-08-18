/*
  Muxer suite: the test Chromium can't encode H.264, but the app's mp4 writer
  (buildMp4) must still be proven against REAL H.264. So: encode the ball
  fixture with ffmpeg to raw Annex-B H.264, convert to AVCC samples + avcC here,
  run them through buildMp4() inside the actual app page, then have ffmpeg
  probe AND fully decode the resulting .mp4.
  Skips (exit 0) if no ffmpeg is available — set $FFMPEG.
*/
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { APP, FIXTURES, OUT, launch } = require('./common');

const FF = process.env.FFMPEG || 'ffmpeg';
try { execFileSync(FF, ['-version'], { stdio: 'ignore' }); }
catch (e) { console.log('SKIP  muxer suite needs ffmpeg (set FFMPEG=/path/to/ffmpeg)'); process.exit(0); }

function splitNals(b){
  const starts = [];
  for (let p = 0; p + 3 <= b.length; p++){
    if (b[p] === 0 && b[p+1] === 0 && (b[p+2] === 1 || (b[p+2] === 0 && b[p+3] === 1))){
      starts.push({ pos: p, len: b[p+2] === 1 ? 3 : 4 });
      p += b[p+2] === 1 ? 2 : 3;
    }
  }
  return starts.map((s, i) => b.subarray(s.pos + s.len, i + 1 < starts.length ? starts[i+1].pos : b.length));
}

(async () => {
  // 1. real H.264, Annex-B, AUD-delimited, no B-frames, keyframe every 60
  const raw = path.join(OUT, 'muxer_raw.264');
  execFileSync(FF, ['-y', '-i', path.join(FIXTURES, 'ball.webm'), '-t', '4',
    '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p',
    '-x264-params', 'aud=1:bframes=0:keyint=60:scenecut=0',
    '-f', 'h264', raw], { stdio: 'ignore' });

  // 2. Annex-B → AVCC access units
  const nals = splitNals(fs.readFileSync(raw));
  let sps = null, pps = null;
  const samples = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.parts.length){
      const len = cur.parts.reduce((s, n) => s + 4 + n.length, 0);
      const data = Buffer.alloc(len);
      let o = 0;
      for (const n of cur.parts){ data.writeUInt32BE(n.length, o); n.copy ? n.copy(data, o + 4) : data.set(n, o + 4); o += 4 + n.length; }
      samples.push({ d: data.toString('base64'), k: cur.key });
    }
  };
  for (const nal of nals){
    const type = nal[0] & 31;
    if (type === 9){ flush(); cur = { parts: [], key: false }; continue; }
    if (type === 7){ sps = nal; continue; }
    if (type === 8){ pps = nal; continue; }
    if (!cur) cur = { parts: [], key: false };
    if (type === 5) cur.key = true;
    cur.parts.push(Buffer.from(nal));
  }
  flush();
  const avcC = Buffer.concat([
    Buffer.from([1, sps[1], sps[2], sps[3], 0xFF, 0xE1, sps.length >> 8, sps.length & 255]),
    Buffer.from(sps),
    Buffer.from([1, pps.length >> 8, pps.length & 255]),
    Buffer.from(pps),
  ]).toString('base64');
  console.log(`prepared ${samples.length} AVCC samples (${samples.filter(s => s.k).length} keyframes)`);

  // 3. run them through the app's real buildMp4()
  const { browser, page, errors, check } = await launch();
  await page.goto(APP);
  const mp4b64 = await page.evaluate(([samplesIn, avcCIn]) => {
    const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const out = buildMp4(samplesIn.map(s => ({ data: un64(s.d), isKey: s.k })), un64(avcCIn), 640, 360, 30);
    let bin = '';
    for (let i = 0; i < out.length; i += 32768) bin += String.fromCharCode(...out.subarray(i, i + 32768));
    return btoa(bin);
  }, [samples, avcC]);
  const outFile = path.join(OUT, 'muxer_test.mp4');
  fs.writeFileSync(outFile, Buffer.from(mp4b64, 'base64'));
  check(`buildMp4 produced a file (${fs.statSync(outFile).size} bytes)`, fs.statSync(outFile).size > 3000);

  // 4. probe + full decode with ffmpeg
  let probe = '';
  try { execFileSync(FF, ['-i', outFile], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { probe = e.stderr.toString(); }
  check('probes as h264 in mp4', /Video: h264/.test(probe) && /avc1/.test(probe));
  const m = probe.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const dur = m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : 0;
  const expect = samples.length / 30;
  check(`duration matches sample count (${dur.toFixed(2)}s ≈ ${expect.toFixed(2)}s)`, Math.abs(dur - expect) < 0.2);

  let decodeErr = '';
  try { execFileSync(FF, ['-v', 'error', '-i', outFile, '-f', 'null', '-'], { stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { decodeErr = 'exit ' + e.status + ': ' + (e.stderr || '').toString(); }
  check('full decode is clean (no stream errors)', decodeErr === '');

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
