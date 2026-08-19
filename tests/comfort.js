/* Comfort mode ("Aa"), a real WCAG AA contrast audit of the dark theme, and
   visible keyboard focus. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');

/* the contrast audit runs inside the page against computed styles */
const CONTRAST_AUDIT = `(() => {
  const lum = ([r, g, b]) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = c => {
    const m = /rgba?\\(([^)]+)\\)/.exec(c);
    if (!m) return null;
    const p = m[1].split(',').map(Number);
    return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
  };
  const over = (fg, bg) => fg.rgb.map((v, i) => v * fg.a + bg[i] * (1 - fg.a));
  const bgOf = el => {
    for (let n = el; n && n !== document.documentElement; n = n.parentElement){
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c.a > 0.6) return c.rgb;
    }
    return [13, 17, 23];
  };
  const ratio = (a, b) => {
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };
  const bad = [];
  for (const el of document.querySelectorAll('*')){
    if (['SCRIPT', 'STYLE', 'VIDEO', 'CANVAS'].includes(el.tagName)) continue;
    if (!el.getClientRects().length) continue;
    const own = [...el.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim().length > 1);
    if (!own) continue;
    const st = getComputedStyle(el);
    if (st.visibility === 'hidden' || +st.opacity < 0.9) continue;   // disabled/faded is exempt
    const fg = parse(st.color);
    if (!fg) continue;
    const px = parseFloat(st.fontSize), bold = +st.fontWeight >= 700;
    const large = px >= 24 || (bold && px >= 18.66);
    const need = large ? 3 : 4.5;
    const r = ratio(over(fg, bgOf(el)), bgOf(el));
    if (r < need)
      bad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]) +
        ' ' + r.toFixed(2) + ':1 (needs ' + need + ') “' + el.textContent.trim().slice(0, 22) + '”');
  }
  return [...new Set(bad)];
})()`;

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  const sizes = () => page.evaluate(() => ({
    body: parseFloat(getComputedStyle(document.body).fontSize),
    play: parseFloat(getComputedStyle(document.querySelector('#btnPlay')).fontSize),
    playH: document.querySelector('#btnPlay').getBoundingClientRect().height,
    hint: parseFloat(getComputedStyle(document.querySelector('#toolHint')).fontSize),
    tab: parseFloat(getComputedStyle(document.querySelector('#tabs button')).fontSize),
  }));

  const before = await sizes();
  check('starts at the normal text size', before.body < 16);

  await page.click('#btnTextSize');
  await page.waitForTimeout(250);
  const after = await sizes();
  check(`large mode bumps the base font (${before.body} → ${after.body})`, after.body >= 16);
  check(`large mode bumps controls too (${before.play} → ${after.play})`, after.play > before.play);
  check(`large mode makes buttons taller (${Math.round(before.playH)} → ${Math.round(after.playH)}px)`,
    after.playH > before.playH);
  check(`small print grows as well (${before.hint} → ${after.hint})`, after.hint > before.hint);
  check(`the tabs grow (${before.tab} → ${after.tab})`, after.tab > before.tab);
  check('the Aa button shows it is on',
    await page.evaluate(() => document.querySelector('#btnTextSize').classList.contains('active')));

  // toasts linger longer when there is more to read
  const life = await page.evaluate(async () => {
    const start = Date.now();
    window.__toastGone = null;
    const t = document.createElement('div');
    return await new Promise(res => {
      const before = document.querySelectorAll('.toast').length;
      document.querySelector('#btnMarkIn').click();
      const iv = setInterval(() => {
        const el = [...document.querySelectorAll('.toast')].pop();
        if (el && el.style.opacity === '0'){ clearInterval(iv); res(Date.now() - start); }
      }, 40);
      setTimeout(() => { clearInterval(iv); res(-1); }, 8000);
    });
  });
  check('toasts stay on screen longer in large mode (' + life + 'ms)', life > 2800);

  // ---- the choice survives a reload ----
  await page.reload();
  await page.waitForTimeout(400);
  check('large mode is remembered',
    await page.evaluate(() => document.body.classList.contains('bigText')));
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForTimeout(300);

  // ---- contrast audit, both sizes and a few screens ----
  let bad = await page.evaluate(CONTRAST_AUDIT);
  check('large mode meets WCAG AA everywhere' + (bad.length ? ' — ' + bad.join(' | ') : ''),
    bad.length === 0);

  await page.click('#btnTextSize');   // back to normal
  await page.waitForTimeout(200);
  check('pressing Aa again returns to normal',
    await page.evaluate(() => !document.body.classList.contains('bigText')));

  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the editor meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);

  await page.click('#tabs button[data-tab=clips]');
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the Clips tab meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);

  await page.click('#tabs button[data-tab=coach]');
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the Coach tab meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);

  await page.click('#btnHelp');
  await page.waitForTimeout(200);
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('Help meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);
  await page.click('#helpClose');

  await page.click('#tabs button[data-tab=draw]');
  await page.click('#btnSaveClip');
  await page.waitForTimeout(250);
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the save-clip dialog meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);
  await page.click('#clipCancel');

  // ---- keyboard focus is visible ----
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
  let focus = null;
  for (let i = 0; i < 6 && !focus; i++){
    await page.keyboard.press('Tab');
    await page.waitForTimeout(80);
    focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return null;
      const st = getComputedStyle(el);
      return { on: el.id || el.tagName, width: parseFloat(st.outlineWidth), style: st.outlineStyle };
    });
  }
  focus = focus || { on: 'nothing', width: 0, style: 'none' };
  check(`tabbing to a control shows a visible ring (${focus.on}: ${focus.width}px ${focus.style})`,
    focus.width >= 2 && focus.style !== 'none');

  const tabbed = await page.evaluate(() => {
    // the first few controls must all be reachable by keyboard
    const reachable = [...document.querySelectorAll('#topbar button, #controls button')]
      .filter(b => b.getClientRects().length && b.tabIndex >= 0);
    return reachable.length;
  });
  check('the top bar and transport are keyboard reachable (' + tabbed + ' controls)', tabbed > 10);

  // ---- the progress dashboard, with real data in it ----
  await page.evaluate(() => {
    localStorage.setItem('filmroom:season1.mp4:100', JSON.stringify({
      version: 1, videoName: 'season1.mp4', videoKey: 'filmroom:season1.mp4:100',
      videoDate: Date.UTC(2026, 2, 1), savedAt: '2026-03-01T00:00:00.000Z',
      annotations: [], clips: [
        { id: 'a', tIn: 0, tOut: 2, title: 'Great scan', rating: 'positive',
          tags: ['Scanned before receiving'], notes: '', position: 'Winger', format: '9v9' },
        { id: 'b', tIn: 3, tOut: 5, title: 'Touch got away', rating: 'negative',
          tags: ['Heavy / poor touch'], notes: '', position: 'Winger', format: '9v9' },
        { id: 'c', tIn: 6, tOut: 8, title: 'Worth talking about', rating: 'neutral',
          tags: ['High-IQ play'], notes: '', position: 'Winger', format: '9v9' },
      ], sessions: [],
    }));
  });
  await page.click('#btnTrends');
  await page.waitForSelector('#trendModal.open');
  await page.waitForTimeout(400);
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the progress dashboard meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''),
    bad.length === 0);
  await page.click('#trendClose');

  // ---- the two onboarding surfaces are audited too ----
  await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    p.clips.push({ id: 'c1', tIn: 1, tOut: 4, title: 'Great scan', rating: 'positive',
      tags: [], notes: '', position: 'Winger', format: '9v9' });
    p.reel = ['c1']; p.reelTitle = 'Week 3 — between the lines';
    window.__filmroom.getProject();
  });
  await page.click('#tabs button[data-tab=clips]');
  await page.evaluate(() => document.querySelector('#reelTitle').dispatchEvent(new Event('input')));
  await page.waitForTimeout(200);
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the watch banner meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);

  await page.evaluate(() => { localStorage.removeItem('filmroom:tourDone'); });
  await page.reload();
  await page.waitForSelector('#tourBubble', { state: 'visible', timeout: 3000 });
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('the walkthrough bubble meets WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''),
    bad.length === 0);
  await page.hover('#btnHelp');
  await page.waitForTimeout(600);
  bad = await page.evaluate(CONTRAST_AUDIT);
  check('tooltips meet WCAG AA' + (bad.length ? ' — ' + bad.join(' | ') : ''), bad.length === 0);

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
