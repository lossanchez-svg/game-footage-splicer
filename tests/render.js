/*
  Reel Studio render pipeline (v5-C): the storyboard becomes the files.

  The bundled Chromium cannot encode H.264, so the VideoEncoder is stubbed
  (the fastexport.js approach — frame counts prove the program's shape; the
  mp4 writer itself is proven against real H.264 in muxer.js). What this
  suite proves:
  - The master reel walks plays from TWO different games, read out of the
    Games folder, into one program: opening card + per-play freeze intro +
    trimmed media + contact card — and none of the family furniture (no
    coach title cards, no decision-point freezes).
  - The file is named after him.
  - A play whose game's video is missing is called out first, and a second
    press makes the reel without it — never silently.
  - The social cut is cards-free (media only), tall, and its crop FOLLOWS
    the tracked spotlight path: the ball stays near the middle of the frame
    while the source pans it across the picture.
*/
const path = require('path');
const fs = require('fs');
const { APP, FIXTURES, OUT, launch } = require('./common');

const ENC_STUB = () => {
  window.__fakeEnc = { frames: 0, keys: 0, samples: [] };
  window.VideoFrame = class {
    constructor(src, opts){
      this.timestamp = opts && opts.timestamp;
      /* every 30th frame, remember where the red ball sits in the OUTPUT
         frame — this is what proves the 9:16 crop follows him */
      const n = window.__fakeEnc.frames;
      if (window.__sampleBall && n % 30 === 15 && src.getContext){
        const ctx = src.getContext('2d');
        const W = src.width, H = src.height;
        const img = ctx.getImageData(0, 0, W, H).data;
        let sx = 0, count = 0;
        for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 4){
          const i = (y * W + x) * 4;
          if (img[i] > 150 && img[i+1] < 110 && img[i+2] < 110){ sx += x; count++; }
        }
        window.__fakeEnc.samples.push({ n, W, H, ballX: count ? sx / count / W : null });
      }
    }
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

/* two games in the folder: ball.webm (the red ball crossing) as both weeks */
const mkGame = (name, clips, anns) => ({
  version: 1, videoName: name, videoKey: 'filmroom:' + name + ':777',
  videoDate: Date.UTC(2026, 2, 1), savedAt: new Date().toISOString(),
  fps: 30, annotations: anns || [], sessions: [], clips,
});
/* the fixture ball's true path — the seeded spotlight tracks it exactly */
const ballKeys = [];
for (let t = 0; t <= 7; t += 0.5)
  ballKeys.push({ t, x: (58 + 40 * t) / 640, y: (180 + 60 * Math.sin(t)) / 360 });

const GAME1 = mkGame('week1.webm',
  [{ id: 'w1c0', tIn: 1, tOut: 5, title: 'Great 1v1 move', rating: 'positive',
     tags: [], notes: '', ask: '', position: 'Attacking Mid', format: '9v9' }],
  [
    { id: 'spot1', type: 'spot', color: '#ffd60a', label: '', r: 0.05,
      tStart: 0, tEnd: 7, keys: ballKeys },
    /* a decision-point INSIDE the play: the recruiting reel must skip it */
    { id: 'p1', type: 'pause', t: 2.5, tStart: 2.5, tEnd: 2.5, question: 'Options?' },
  ]);
const GAME2 = mkGame('week2.webm',
  [{ id: 'w2c0', tIn: 2, tOut: 4, title: 'Finish at the back post', rating: 'positive',
     tags: [], notes: '', ask: '', position: 'Attacking Mid', format: '9v9' }],
  [{ id: 'spot2', type: 'spot', color: '#ffd60a', label: '', r: 0.05,
     tStart: 0, tEnd: 7, keys: ballKeys }]);

const PLAN = title => ({
  title,
  items: [
    { gameName: 'week1.webm', date: Date.UTC(2026, 2, 1), clipId: 'w1c0',
      title: 'Great 1v1 move', rating: 'positive', tIn: 1, tOut: 5,
      trimIn: 1, trimOut: 4, spotlight: true, freezeIntro: true,
      label: 'vs Slammers FC · Mar 1', tags: [], notes: '' },
    { gameName: 'week2.webm', date: Date.UTC(2026, 2, 1), clipId: 'w2c0',
      title: 'Finish at the back post', rating: 'positive', tIn: 2, tOut: 4,
      trimIn: 2, trimOut: 4, spotlight: false, freezeIntro: false,
      label: 'vs Inter · Mar 8', tags: [], notes: '' },
  ],
  savedAt: new Date().toISOString(),
});
const CARD = { name: 'Jude Sanchez', jersey: '81', gradYear: '2032',
  positions: 'Attacking Mid', club: 'FC Dallas', contact: 'reach@example.com',
  links: '@judefootball', savedAt: new Date().toISOString() };

async function fresh(browser, { videos, plan } = {}){
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const vids = {};
  for (const v of videos || [])
    vids[v] = fs.readFileSync(path.join(FIXTURES, 'ball.webm')).toString('base64');
  await page.addInitScript(ENC_STUB);
  await page.addInitScript(vidMap => {
    const store = new Map();
    for (const [name, b64] of Object.entries(vidMap))
      store.set(name, Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    const jsons = new Map();
    const dir = {
      kind: 'directory', name: 'Game Film',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFileHandle: async (name, opts) => {
        if (store.has(name))
          return { kind: 'file', name,
            getFile: async () => new File([store.get(name)], name, { type: 'video/webm' }) };
        if (!jsons.has(name) && !(opts && opts.create)) throw new Error('NotFound');
        return { kind: 'file', name,
          getFile: async () => new File([jsons.get(name) || ''], name),
          createWritable: async () => {
            let buf = '';
            return { write: async c => { buf += c; }, close: async () => { jsons.set(name, buf); } };
          } };
      },
      values: async function*(){
        for (const name of store.keys())
          yield { kind: 'file', name,
            getFile: async () => new File([store.get(name)], name, { type: 'video/webm', lastModified: 1000 }) };
      },
    };
    window.showDirectoryPicker = async () => dir;
  }, vids);
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('CONSOLE: ' + m.text()); });
  await page.goto(APP);
  await page.evaluate(({ g1, g2, planJson, card }) => {
    localStorage.clear();
    localStorage.setItem('filmroom:tourDone', '1');
    localStorage.setItem(g1.videoKey, JSON.stringify(g1));
    localStorage.setItem(g2.videoKey, JSON.stringify(g2));
    localStorage.setItem('filmroom:reelStudio', planJson);
    localStorage.setItem('filmroom:playerCard', JSON.stringify(card));
  }, { g1: GAME1, g2: GAME2, planJson: JSON.stringify(plan), card: CARD });
  await page.reload();
  await page.waitForTimeout(500);          // fastSupported probes at startup
  /* connect the stubbed Games folder */
  await page.click('#btnLibrary');
  await page.waitForSelector('#libModal.open');
  await page.click('#libChoose');
  await page.waitForTimeout(400);
  await page.click('#libClose');
  return { ctx, page, pageErrors };
}

const openStudio = async page => {
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.waitForTimeout(300);
};

(async () => {
  const { browser, errors, check, page: p0 } = await launch();
  await p0.close();

  /* ---- the master reel: two games, one file ---- */
  {
    const { ctx, page, pageErrors } = await fresh(browser,
      { videos: ['week1.webm', 'week2.webm'], plan: PLAN('Jude Sanchez — 2026 season') });
    await openStudio(page);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 300000 }),
      page.click('#studioMake'),
    ]);
    check(`the file a coach receives is named after him (${dl.suggestedFilename()})`,
      /^Jude Sanchez - 2032 - Attacking Mid - Jude Sanchez - 2026 season\.mp4$/.test(dl.suggestedFilename()));
    const enc = await page.evaluate(() => window.__fakeEnc);
    /* 3s opening + 1.4s freeze + 3s media + 2s media + 3s contact = 372
       frames. No 2.8s coach cards, and the decision point at 2.5s must NOT
       have added its 3.2s freeze — either would blow the tolerance. */
    check(`the program is opening + freeze + plays + contact card (${enc.frames} ≈ 372 frames)`,
      enc.frames >= 355 && enc.frames <= 390);
    /* muxer-level: the studio output goes through the same hand-rolled mp4
       writer proven against real H.264 in muxer.js — probe the container */
    const saved = path.join(OUT, 'studio_reel.mp4');
    await dl.saveAs(saved);
    const head = fs.readFileSync(saved);
    check(`the reel is a real mp4 container (${head.slice(4, 8)} box up front, ${head.length} bytes)`,
      head.length > 5000 && head.slice(4, 8).toString() === 'ftyp' &&
      head.includes(Buffer.from('moov')) && head.includes(Buffer.from('mdat')));
    check('no page errors while rendering across two games', pageErrors.length === 0);
    await ctx.close();
  }

  /* ---- a missing game is called out, then skipped only on the second press ---- */
  {
    const plan = PLAN('Test');
    plan.items.push({ gameName: 'gone.mp4', date: 0, clipId: 'x0', title: 'Lost play',
      rating: 'positive', tIn: 0, tOut: 3, trimIn: 0, trimOut: 3,
      spotlight: true, freezeIntro: false, label: '', tags: [], notes: '' });
    const { ctx, page } = await fresh(browser,
      { videos: ['week1.webm', 'week2.webm'], plan });
    await openStudio(page);
    await page.click('#studioMake');
    await page.waitForTimeout(500);
    check('the missing game is named before anything renders',
      await page.isVisible('#studioMissing') &&
      /gone/.test(await page.textContent('#studioMissing')));
    check('and the button now says what a second press will do',
      /without/.test(await page.textContent('#studioMake')));
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 300000 }),
      page.click('#studioMake'),
    ]);
    check('the second press makes the reel without the lost play',
      dl.suggestedFilename().endsWith('.mp4'));
    const enc = await page.evaluate(() => window.__fakeEnc);
    check(`only the readable plays rendered (${enc.frames} ≈ 372 frames)`,
      enc.frames >= 355 && enc.frames <= 390);
    await ctx.close();
  }

  /* ---- the social cut: tall, cards-free, and the crop follows him ---- */
  {
    const plan = {
      title: 'Watch him go',
      items: [{ gameName: 'week1.webm', date: Date.UTC(2026, 2, 1), clipId: 'w1c0',
        title: 'Great 1v1 move', rating: 'positive', tIn: 1, tOut: 5,
        trimIn: 1, trimOut: 5, spotlight: false, freezeIntro: false,
        label: '', tags: [], notes: '' }],
      savedAt: new Date().toISOString(),
    };
    const { ctx, page, pageErrors } = await fresh(browser,
      { videos: ['week1.webm'], plan });
    await page.evaluate(() => { window.__sampleBall = true; });
    await openStudio(page);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 300000 }),
      page.click('#studioSocial'),
    ]);
    check(`the social file says what it is (${dl.suggestedFilename()})`,
      /social/.test(dl.suggestedFilename()));
    const enc = await page.evaluate(() => window.__fakeEnc);
    check(`the social cut is media only — no cards (${enc.frames} ≈ 120 frames)`,
      enc.frames >= 110 && enc.frames <= 130);
    const shots = enc.samples.filter(s => s.ballX != null);
    check(`the output frame is tall (${enc.samples[0] && enc.samples[0].W}x${enc.samples[0] && enc.samples[0].H})`,
      enc.samples.length > 0 && enc.samples[0].W === 1080 && enc.samples[0].H === 1920);
    /* the source pans the ball from x=58px to 298px across a 640px frame;
       a fixed centre crop would lose it — following keeps it mid-frame */
    check(`the crop follows the tracked path: ball near centre in ${shots.length} sampled frames ` +
      `(${shots.map(s => s.ballX.toFixed(2)).join(', ')})`,
      shots.length >= 3 && shots.every(s => s.ballX > 0.25 && s.ballX < 0.75));
    check('no page errors during the social render', pageErrors.length === 0);
    await ctx.close();
  }

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
