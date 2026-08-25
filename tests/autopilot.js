/*
  Autopilot (v6-E): opt-in, draft-only, measured.

  What must be true:
  - AUTOPILOT.md exists and carries the hard rules IN WRITING: draft-only,
    never posts/exports on its own authority, the three privacy tiers with
    E0 (no pixels) as the default, and the edit-distance report card.
  - The ledger is real: importing a plan fingerprints it, and after the
    human reorders / re-trims / retitles through the REAL UI, the next
    metadata export counts exactly those corrections.
  - The render leg drives the actual app end to end (stub encoder, the
    fastexport pattern): plan in → "DRAFT - …" mp4 file out, never
    overwriting, refusing multi-game plans in plain words.
*/
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { APP, FIXTURES, launch } = require('./common');

(async () => {
  const { browser, page, errors, check } = await launch();

  /* ---- the contract is written down ---- */
  const doc = fs.readFileSync(path.resolve(__dirname, '..', 'AUTOPILOT.md'), 'utf8');
  check('AUTOPILOT.md exists and is draft-only in writing',
    /always a draft/i.test(doc) && /never exports on its own authority/i.test(doc));
  check('it never posts anywhere, in writing', /never posts anywhere/i.test(doc));
  check('the three tiers are spelled out, E0 the default',
    /E0 — metadata only \(the default\)/.test(doc) && /E1 — stills on approval/.test(doc) &&
    /E2 — fully local \(future\)/.test(doc));
  check('E0 promises no pixels', /words and numbers, never pixels/.test(doc));
  check('the report card is the app-measured edit distance',
    /editsSinceImport/.test(doc) && /measured, not argued/i.test(doc));
  check('the review sheet has a Not sure section (honesty has a place to live)',
    /Not sure/.test(doc));

  /* ---- the ledger, through the real UI ---- */
  const PROJ = {
    version: 1, videoName: 'week1.mp4', videoKey: 'filmroom:week1.mp4:100',
    videoDate: Date.UTC(2026, 2, 1), savedAt: new Date().toISOString(),
    fps: 30, annotations: [], sessions: [],
    clips: [
      { id: 'c0', tIn: 0, tOut: 6, title: 'Great 1v1 move', rating: 'positive',
        tags: [], notes: '', ask: '', position: 'Winger', format: '9v9' },
      { id: 'c1', tIn: 10, tOut: 16, title: 'The through ball', rating: 'positive',
        tags: [], notes: '', ask: '', position: 'Winger', format: '9v9' },
    ],
  };
  await page.goto(APP);
  await page.evaluate(p => {
    localStorage.clear();
    localStorage.setItem('filmroom:tourDone', '1');
    localStorage.setItem(p.videoKey, JSON.stringify(p));
  }, PROJ);
  await page.reload();
  const imp = await page.evaluate(p => window.__filmroom.socket.importPlan(p), {
    format: 'filmroom-reelplan', version: 1, title: 'Autopilot draft',
    items: [
      { game: 'week1.mp4', clipId: 'c0', trimIn: 1, trimOut: 5 },
      { game: 'week1.mp4', clipId: 'c1', trimIn: 10, trimOut: 15 },
    ],
  });
  check('the draft imports cleanly', !imp.error && imp.loaded === 2);
  const fresh = await page.evaluate(async () =>
    (await window.__filmroom.socket.metadata()).reelPlan.editsSinceImport);
  check(`an untouched draft counts zero corrections (${JSON.stringify(fresh && fresh.total)})`,
    fresh && fresh.total === 0);

  /* now the human corrects it: reorder, re-trim, retitle — through the UI */
  await page.click('#btnStudio');
  await page.waitForSelector('#studioModal.open');
  await page.waitForTimeout(300);
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("↓")');
  await page.waitForTimeout(150);
  await page.click('.sbCard[data-i="0"] .sbCtl button:has-text("✂")');
  await page.waitForTimeout(150);
  await page.click('.sbTrim button:has-text("+½s")');
  await page.waitForTimeout(150);
  await page.fill('#studioTitle', 'The parent’s cut');
  await page.press('#studioTitle', 'Tab');
  await page.waitForTimeout(150);
  const edits = await page.evaluate(async () =>
    (await window.__filmroom.socket.metadata()).reelPlan.editsSinceImport);
  check(`the ledger counts the corrections (${JSON.stringify(edits)})`,
    edits && edits.reordered >= 1 && edits.retrimmed === 1 && edits.retitled === 1 &&
    edits.removed === 0 && edits.added === 0 &&
    edits.total === edits.reordered + edits.retrimmed + edits.retitled);
  await page.click('#studioClose');
  await page.close();

  /* ---- the render leg, end to end with the stub encoder ---- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot-'));
  const proj2 = { ...PROJ, videoName: 'two.webm', videoKey: 'filmroom:two.webm:100',
    clips: [{ id: 'c0', tIn: 1, tOut: 4, title: 'Great 1v1 move', rating: 'positive',
      tags: [], notes: '', ask: '', position: 'Winger', format: '9v9' }] };
  fs.writeFileSync(path.join(tmp, 'project.json'), JSON.stringify(proj2));
  fs.writeFileSync(path.join(tmp, 'plan.json'), JSON.stringify({
    format: 'filmroom-reelplan', version: 1, title: 'Driver draft',
    items: [{ game: 'two.webm', clipId: 'c0', trimIn: 1, trimOut: 4, freezeIntro: false }],
  }));
  let out = '';
  try {
    out = execFileSync('node', [path.resolve(__dirname, 'autopilot', 'render.js'),
      path.join(FIXTURES, 'two.webm'), path.join(tmp, 'project.json'),
      path.join(tmp, 'plan.json'), tmp, '--stub-encoder'],
      { encoding: 'utf8', timeout: 300000 });
  } catch (e){ out = (e.stdout || '') + (e.stderr || ''); }
  const draft = fs.readdirSync(tmp).find(f => f.startsWith('DRAFT - ') && f.endsWith('.mp4'));
  check(`the driver wrote a draft file (${draft})`, !!draft);
  check('and said, in its own output, that it is a draft to review',
    /It is a DRAFT/.test(out));
  const bytes = draft ? fs.readFileSync(path.join(tmp, draft)) : Buffer.alloc(0);
  check('the draft is a real mp4 container',
    bytes.length > 1000 && bytes.slice(4, 8).toString() === 'ftyp');

  /* a multi-game plan is refused in plain words */
  fs.writeFileSync(path.join(tmp, 'plan2.json'), JSON.stringify({
    format: 'filmroom-reelplan', version: 1, title: 'x',
    items: [{ game: 'other.mp4', clipId: 'z1', trimIn: 0, trimOut: 3 }],
  }));
  let refuse = '';
  try {
    execFileSync('node', [path.resolve(__dirname, 'autopilot', 'render.js'),
      path.join(FIXTURES, 'two.webm'), path.join(tmp, 'project.json'),
      path.join(tmp, 'plan2.json'), tmp, '--stub-encoder'],
      { encoding: 'utf8', timeout: 60000 });
  } catch (e){ refuse = (e.stdout || '') + (e.stderr || ''); }
  check('a plan from other games is refused toward the app, not half-rendered',
    /other games/.test(refuse) && /Make the reel there/.test(refuse));

  fs.rmSync(tmp, { recursive: true, force: true });

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
