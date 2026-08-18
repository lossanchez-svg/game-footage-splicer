/* Plain-language pass: the words on screen must be ones a first-time,
   non-technical user understands — and every screen must be reachable and
   render (a screenshot pass over each tab and mode doubles as a smoke test). */
const path = require('path');
const { APP, FIXTURES, OUT, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');
const shot = (page, name) => page.screenshot({ path: path.join(OUT, 'plain_' + name + '.png') });

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();

  // ---- the empty state names the single next action ----
  const empty = await page.textContent('#dropHint');
  check('empty state states the one next action',
    /Start by opening a video/i.test(empty));
  check('empty state explains the Mac folder button needs Chrome or Edge',
    /Chrome or Edge/i.test(empty));
  await shot(page, '1_empty');

  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  // ---- renamed controls ----
  const label = sel => page.textContent(sel);
  check('“In” is now “Start clip here”', (await label('#btnMarkIn')).includes('Start clip here'));
  check('“Out” is now “End clip here”', (await label('#btnMarkOut')).includes('End clip here'));
  check('“Still” is now “Photo”', (await label('#btnSnapshot')).includes('Photo'));
  check('“Export clip” is now “Save video”', (await label('#btnExport')).includes('Save video'));
  check('the reel button says what it makes',
    (await label('#btnExportReel')).includes('one video'));
  check('“Run session” says what it is for',
    (await label('#btnRunSession')).includes('Watch together'));

  // ---- fps folded into an Advanced disclosure, off by default ----
  check('the frame-rate box is hidden inside Advanced',
    await page.evaluate(() => {
      const d = document.querySelector('#advBox');
      return d && !d.open && !document.querySelector('#fpsInput').checkVisibility();
    }));
  check('the transport bar no longer shouts “fps”',
    await page.evaluate(() => !/\bfps\b/.test(document.querySelector('#controls').textContent)));
  await page.click('#advBox summary');
  await page.waitForTimeout(150);
  check('opening Advanced reveals the frame-rate box, in words',
    await page.evaluate(() => document.querySelector('#fpsInput').checkVisibility() &&
      /Pictures per second/i.test(document.querySelector('#advBox').textContent)));
  await page.click('#advBox summary');

  // ---- export mode picker in plain names ----
  const modes = await page.evaluate(() =>
    [...document.querySelectorAll('#exportMode option')].map(o => o.textContent));
  check('export modes have plain names (' + modes.join(' / ') + ')',
    modes.some(m => /Best for iPhone/i.test(m)) && modes.some(m => /Keeps sound/i.test(m)));

  // ---- nothing on screen uses developer words ----
  const jargon = await page.evaluate(() => {
    const banned = /\bfps\b|\bmux\b|\bkeyframes?\b|\bnormali[sz]ed\b|\bcodec\b|\bH\.264\b|WebCodecs|\bIn→Out\b|\bplayhead\b|MediaRecorder|\bAAC\b|\bISO-BMFF\b/i;
    const hits = [];
    const walk = root => {
      for (const el of root.querySelectorAll('*')){
        if (el.closest('#panel-coach')) continue;
        if (['SCRIPT', 'STYLE'].includes(el.tagName)) continue;
        for (const n of el.childNodes)
          if (n.nodeType === 3 && banned.test(n.nodeValue)) hits.push(n.nodeValue.trim().slice(0, 60));
        const tip = el.getAttribute('data-tip');
        if (tip && banned.test(tip)) hits.push('tip: ' + tip.slice(0, 60));
        const ph = el.getAttribute('placeholder');
        if (ph && banned.test(ph)) hits.push('placeholder: ' + ph);
      }
    };
    walk(document);
    return [...new Set(hits)];
  });
  check('no developer jargon on any surface' + (jargon.length ? ' — ' + jargon.join(' | ') : ''),
    jargon.length === 0);

  // ---- every toast is a full sentence ----
  const toastCopy = await page.evaluate(() => {
    // pull every toast() call out of the app's own source, whole argument list,
    // and join the string literals in it — a message built by concatenation
    // still has to read as a sentence
    const src = [...document.querySelectorAll('script')].map(s => s.textContent).join('\n');
    const out = [];
    for (let i = src.indexOf('toast('); i >= 0; i = src.indexOf('toast(', i + 1)){
      let depth = 0, j = i + 5;
      for (; j < src.length; j++){
        if (src[j] === '(') depth++;
        else if (src[j] === ')' && --depth === 0) break;
      }
      const call = src.slice(i + 6, j);
      const lits = call.match(/(['`])(?:\\.|(?!\1)[^\\])*\1/g) || [];
      const text = lits.map(l => l.slice(1, -1)).join(' ').trim();
      if (text) out.push(text);
    }
    return out;
  });
  const terse = toastCopy.filter(t => t.length > 3 && !/[.!?]/.test(t));
  check('every toast is a full sentence (' + toastCopy.length + ' checked)' +
    (terse.length ? ' — ' + terse.join(' | ') : ''), terse.length === 0);

  // ---- marking a clip talks the user through it ----
  await page.evaluate(() => { document.querySelector('#video').currentTime = 1; });
  await page.waitForTimeout(150);
  await page.click('#btnMarkIn');
  await page.waitForTimeout(120);
  const t1 = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));
  check('marking the start says what to do next', /End clip here/.test(t1));
  await page.evaluate(() => { document.querySelector('#video').currentTime = 3; });
  await page.waitForTimeout(120);
  await page.click('#btnMarkOut');
  await page.waitForTimeout(120);
  const t2 = await page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));
  check('marking the end says what to do next', /Save clip/.test(t2));

  // ---- every empty state names its single next action ----
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await shot(page, '2_saveclip');
  await page.fill('#clipTitle', 'A good scan');
  await page.click('#clipSave');
  await page.waitForTimeout(250);
  await page.click('#tabs button[data-tab=clips]');
  const sessionEmpty = await page.textContent('#sessionEmptyHint');
  check('the session log empty state names the action that fills it',
    /Watch together/.test(sessionEmpty));
  await shot(page, '3_clips');

  await page.click('#tabs button[data-tab=coach]');
  await shot(page, '4_coach');
  await page.click('#tabs button[data-tab=draw]');
  await shot(page, '5_draw');

  // ---- the other two modes still render ----
  await page.click('#btnBoard');
  await page.waitForTimeout(400);
  check('the tactics board opens', await page.evaluate(() =>
    document.querySelector('#boardWrap').style.display !== 'none'));
  await shot(page, '6_board');
  await page.click('#boardClose');

  await page.evaluate(() => {                       // compare needs two clips
    const p = window.__filmroom.getProject();
    p.clips.push({ ...p.clips[0], id: 'second', title: 'The model version' });
  });
  await page.click('#tabs button[data-tab=clips]');
  await page.click('#clipList [data-act=compare]');
  await page.waitForTimeout(500);
  check('side-by-side opens', await page.evaluate(() =>
    document.querySelector('#compareWrap').style.display !== 'none'));
  await shot(page, '7_compare');
  await page.click('#cmpClose');

  await page.click('#btnHelp');
  await page.waitForTimeout(200);
  await shot(page, '8_help');
  check('help talks in the same words as the buttons',
    /Start clip here/.test(await page.textContent('#helpBox')));
  await page.click('#helpClose');

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
