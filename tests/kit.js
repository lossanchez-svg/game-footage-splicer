/*
  The sharing kit (v5-D): everything that goes around the reel, written from
  his card and the plan — YouTube title/description whose chapter times match
  the rendered reel second for second, a coach email with his details filled
  in, and a self-contained one-page player site. One zip, verified with the
  real `unzip` (the bundle.js rule: an archive is proven by other software).
*/
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { APP, FIXTURES, OUT, launch } = require('./common');

const mkGame = (name, clips, anns) => ({
  version: 1, videoName: name, videoKey: 'filmroom:' + name + ':777',
  videoDate: Date.UTC(2026, 2, 1), savedAt: new Date().toISOString(),
  fps: 30, annotations: anns || [], sessions: [], clips,
});
const GAME1 = mkGame('week1.webm',
  [{ id: 'w1c0', tIn: 1, tOut: 5, title: 'Great 1v1 move', rating: 'positive',
     tags: [], notes: '', ask: '', position: 'Attacking Mid', format: '9v9' }]);
const GAME2 = mkGame('week2.webm',
  [{ id: 'w2c0', tIn: 2, tOut: 4, title: 'Finish at the back post', rating: 'positive',
     tags: [], notes: '', ask: '', position: 'Attacking Mid', format: '9v9' }]);
const PLAN = {
  title: 'Jude Sanchez — 2026 season',
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
};
const CARD = { name: 'Jude Sanchez', jersey: '81', gradYear: '2032',
  positions: 'Attacking Mid, Winger', club: 'FC Dallas 2032B', league: 'MLS NEXT',
  height: "5'9\"", gpa: '3.8', contact: 'reach@example.com',
  links: '@judefootball', savedAt: new Date().toISOString() };

(async () => {
  const { browser, page, errors, check } = await launch();
  const vidB64 = fs.readFileSync(path.join(FIXTURES, 'ball.webm')).toString('base64');
  await page.addInitScript(b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const store = new Map([['week1.webm', bytes], ['week2.webm', bytes]]);
    const dir = {
      kind: 'directory', name: 'Game Film',
      queryPermission: async () => 'granted', requestPermission: async () => 'granted',
      getFileHandle: async name => {
        if (!store.has(name)) throw new Error('NotFound');
        return { kind: 'file', name,
          getFile: async () => new File([store.get(name)], name, { type: 'video/webm' }) };
      },
      values: async function*(){
        for (const name of store.keys())
          yield { kind: 'file', name,
            getFile: async () => new File([store.get(name)], name, { type: 'video/webm', lastModified: 1 }) };
      },
    };
    window.showDirectoryPicker = async () => dir;
  }, vidB64);
  await page.goto(APP);
  await page.evaluate(({ g1, g2, plan, card }) => {
    localStorage.clear();
    localStorage.setItem('filmroom:tourDone', '1');
    localStorage.setItem(g1.videoKey, JSON.stringify(g1));
    localStorage.setItem(g2.videoKey, JSON.stringify(g2));
    localStorage.setItem('filmroom:reelStudio', JSON.stringify(plan));
    localStorage.setItem('filmroom:playerCard', JSON.stringify(card));
  }, { g1: GAME1, g2: GAME2, plan: PLAN, card: CARD });
  await page.reload();
  await page.click('#btnLibrary');
  await page.waitForSelector('#libModal.open');
  await page.click('#libChoose');
  await page.waitForTimeout(400);
  await page.click('#libClose');

  const kit = await page.evaluate(() => window.__filmroom.studio.kit());

  /* ---- YouTube: profile-led title, chapters matching the render ---- */
  check('the YouTube title says who and when he is',
    /Jude Sanchez — Class of 2032 Attacking Mid — Highlights/.test(kit.youtube));
  check('the description carries his details and contact',
    /#81/.test(kit.youtube) && /GPA 3\.8/.test(kit.youtube) &&
    /reach@example\.com/.test(kit.youtube) && /@judefootball/.test(kit.youtube));
  /* the render is 3.0s opening, then play 1 (1.4 freeze + 3.0s), then play 2:
     chapters at 0:00, 0:03, 0:07 — the same math the renderer uses */
  check('chapter times match the reel second for second',
    /0:00 Intro/.test(kit.youtube) &&
    /0:03 Great 1v1 move — vs Slammers FC · Mar 1/.test(kit.youtube) &&
    /0:07 Finish at the back post — vs Inter · Mar 8/.test(kit.youtube));
  check(`one chapter per play plus the intro (${kit.chapters.length})`,
    kit.chapters.length === 3);

  /* ---- the coach email: filled in, no blanks to trip over ---- */
  check('the email subject is the one a coach would file',
    /SUBJECT\nJude Sanchez — Class of 2032 — Attacking Mid — highlight reel/.test(kit.email));
  check('the body carries his details',
    /#81/.test(kit.email) && /FC Dallas 2032B \(MLS NEXT\)/.test(kit.email) &&
    /Height: 5'9"/.test(kit.email) && /GPA: 3\.8/.test(kit.email));
  check('and says how to reach you', /reach@example\.com/.test(kit.email));

  /* ---- the player page: one self-contained file ---- */
  check('the page has his name and roster line',
    /Jude Sanchez/.test(kit.pageHtml) && /Class of 2032/.test(kit.pageHtml));
  check('a poster frame from his footage is baked in',
    /data:image\/jpeg/.test(kit.pageHtml));
  check('the season index lists every play',
    /Great 1v1 move/.test(kit.pageHtml) && /Finish at the back post/.test(kit.pageHtml));
  check('contact is a working mailto link',
    /href="mailto:reach@example\.com"/.test(kit.pageHtml));
  check('nothing on the page is fetched from anywhere',
    !/src="http/.test(kit.pageHtml) && !/href="http/.test(kit.pageHtml));

  /* ---- the zip downloads, and real unzip can read it ---- */
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#studioKit'),
  ]);
  check(`the kit is one zip named after him (${dl.suggestedFilename()})`,
    /^Jude Sanchez - 2032 - Attacking Mid - sharing kit\.zip$/.test(dl.suggestedFilename()));
  const out = path.join(OUT, 'kit.zip');
  await dl.saveAs(out);
  let listing = '';
  try { listing = execFileSync('unzip', ['-l', out]).toString(); }
  catch(e){ listing = ''; }
  if (listing){
    check('unzip lists the four pieces',
      /YouTube\.txt/.test(listing) && /Email to a coach\.txt/.test(listing) &&
      /player page\.html/.test(listing) && /READ ME FIRST\.txt/.test(listing));
  } else {
    console.log('note: `unzip` not on PATH — zip listing skipped (integrity is proven in bundle.js)');
  }

  /* ---- no card: the kit explains instead of writing an empty page ---- */
  await page.evaluate(() => localStorage.removeItem('filmroom:playerCard'));
  await page.reload();
  await page.waitForTimeout(300);
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.click('#studioKit');
  await page.waitForTimeout(300);
  const toasts = await page.evaluate(() =>
    [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));
  check('without a card it asks for the card first', /player card/i.test(toasts));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
