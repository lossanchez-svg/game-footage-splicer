/*
  The Autopilot's render leg (v6-E): drive the real app headlessly to turn a
  reel plan into a DRAFT mp4 — the same way the test suite drives it, on the
  user's own machine, nothing leaving it.

  Usage:
    node tests/autopilot/render.js <video> <project.json> <plan.json> <outDir>
    node tests/autopilot/render.js --check          # can this machine render?

  Notes, honestly:
  - One game per run: the plan's plays must all come from <video>'s game.
    Multi-game plans render through the app's own 🎬 Make the reel button
    with your real Games folder connected — that path handles everything.
  - H.264 needs a real Chrome/Chromium (set CHROME_PATH). --check tells you.
  - --stub-encoder exists for the test suite only: it exercises the whole
    flow with a fake encoder, so the output plays nowhere. Never use it for
    a real draft.
  - The output is a draft file in <outDir>. This script never overwrites an
    existing file, never uploads, never posts.
*/
const path = require('path');
const fs = require('fs');
const { APP, launch } = require('../common');

const ENC_STUB = () => {
  window.VideoFrame = class {
    constructor(src, opts){ this.timestamp = opts && opts.timestamp; }
    close(){}
  };
  window.VideoEncoder = class {
    static async isConfigSupported(){ return { supported: true }; }
    constructor({ output }){ this.output = output; this.encodeQueueSize = 0; }
    configure(){}
    encode(frame, opts){
      const data = new Uint8Array(64).fill(7);
      const meta = this._first ? undefined
        : { decoderConfig: { description: new Uint8Array([1, 66, 0, 40, 255, 225, 0, 2, 103, 66, 1, 0, 104]) } };
      this._first = true;
      this.output({ byteLength: data.length, type: (opts && opts.keyFrame) ? 'key' : 'delta',
        copyTo: d => d.set(data) }, meta);
    }
    async flush(){}
    close(){}
  };
};

async function checkOnly(){
  const { browser, page } = await launch();
  try {
    await page.goto(APP);
    const ok = await page.evaluate(async () => {
      try {
        if (!window.VideoEncoder) return false;
        const r = await VideoEncoder.isConfigSupported({ codec: 'avc1.420028',
          width: 1280, height: 720, bitrate: 8_000_000, framerate: 30, avc: { format: 'avc' } });
        return !!(r && r.supported);
      } catch (e){ return false; }
    });
    if (ok) console.log('OK: this browser can encode H.264 — drafts will render.');
    else console.log('NOTE: no H.264 encoder here. Set CHROME_PATH to a real Chrome/Chromium ' +
      'build and run again — or press 🎬 Make the reel in the app yourself.');
  } finally { await browser.close(); }
}

async function main(){
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const stub = process.argv.includes('--stub-encoder');
  if (process.argv.includes('--check')) return checkOnly();
  if (args.length < 4){
    console.log('usage: node tests/autopilot/render.js <video> <project.json> <plan.json> <outDir>');
    console.log('       node tests/autopilot/render.js --check');
    process.exit(2);
  }
  const [videoPath, projPath, planPath, outDir] = args;
  const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  if (plan.format !== 'filmroom-reelplan')
    throw new Error('that plan file is not a filmroom-reelplan');
  const videoName = path.basename(videoPath);
  const foreign = (plan.items || []).filter(i => i.game !== proj.videoName);
  if (foreign.length)
    throw new Error(`this driver renders one game per run; ${foreign.length} play(s) come from ` +
      `other games — load the plan in the app and press Make the reel there instead`);
  fs.mkdirSync(outDir, { recursive: true });

  const { browser, page } = await launch();
  try {
    if (stub) await page.addInitScript(ENC_STUB);
    await page.goto(APP);
    if (stub) await page.reload();
    await page.evaluate(p => {
      localStorage.clear();
      localStorage.setItem('filmroom:tourDone', '1');
      localStorage.setItem(p.videoKey || ('filmroom:' + p.videoName + ':0'), JSON.stringify(p));
    }, proj);
    await page.reload();
    await page.waitForTimeout(400);              // the encoder probe settles
    await page.setInputFiles('#fileVideo', videoPath);
    await page.waitForSelector('#videoWrap', { state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#video').duration > 0.5);
    const r = await page.evaluate(p => window.__filmroom.socket.importPlan(p), plan);
    if (r.error) throw new Error(r.error);
    console.log(`plan loaded: ${r.loaded} plays${r.missing ? ` (${r.missing} unresolvable)` : ''}`);
    await page.click('#btnStudio');
    await page.waitForSelector('#studioModal.open');
    await page.waitForTimeout(400);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 6 * 3600 * 1000 }),
      page.click('#studioMake'),
    ]);
    let out = path.join(outDir, 'DRAFT - ' + dl.suggestedFilename());
    let n = 2;
    while (fs.existsSync(out))
      out = path.join(outDir, `DRAFT ${n++} - ` + dl.suggestedFilename());
    await dl.saveAs(out);
    console.log('draft written: ' + out);
    console.log('It is a DRAFT. Review it in the app before it goes anywhere.');
  } finally { await browser.close(); }
}

main().catch(e => { console.error('ERROR: ' + e.message); process.exit(1); });
