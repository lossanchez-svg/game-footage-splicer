/* The timeline clip micro-menu: hovering a clip block shows the same actions as the
   sidebar card (routed through the same dispatcher), the seek click is untouched,
   and the quick-mark chips yield while the menu owns the hover. Mouse only. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

let errors = 0;
const check = (name, ok) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) errors++; };

(async () => {
  const { browser, page, errors: pageErrors } = await launch();
  await page.goto(APP);
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => {
    const v = document.querySelector('#video');
    return v && v.duration > 5;
  });

  // save one clip (2s–4s) through the real flow
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 4; });
  await page.click('#btnMarkOut');
  await page.keyboard.press('Enter');
  await page.fill('#clipTitle', 'Line-breaking pass');
  await page.click('#clipSave');
  await page.waitForTimeout(150);

  const menuVisible = () => page.evaluate(() =>
    document.querySelector('#microMenu').style.display === 'block');
  const bar = () => page.locator('#tlClips .tlClip').first();

  // ---- hover the block → the menu fades in with the clip's identity ----
  await bar().hover();
  await page.waitForTimeout(300);   // 150ms intent delay + fade
  check('hovering the clip block shows the micro-menu', await menuVisible());
  const name = await page.locator('#mmName').textContent();
  check('the menu names the clip (got: ' + name + ')', name === 'Line-breaking pass');
  const btns = await page.locator('#mmRow button').allTextContents();
  check('Play, Edit and Reel are offered (' + btns.join(' · ') + ')',
    btns.some(t => /Play/.test(t)) && btns.some(t => /Edit/.test(t)) && btns.some(t => /Reel/.test(t)));
  const tipped = await page.evaluate(() =>
    [...document.querySelectorAll('#mmRow button')].every(b =>
      (b.dataset.tip || '').split(' ').length > 5));
  check('every menu button carries a full-sentence tip', tipped);

  // ---- ➕ Reel routes through the same dispatcher as the sidebar ----
  await page.locator('#mmRow button', { hasText: 'Reel' }).click();
  await page.waitForTimeout(120);
  const inReel = await page.evaluate(() =>
    (window.__filmroom.getProject().reel || []).length === 1);
  check('the Reel button added the clip to this week’s set', inReel);
  check('acting from the menu closes it', !(await menuVisible()));
  await bar().hover();
  await page.waitForTimeout(300);
  const reelLbl = await page.locator('#mmRow button', { hasText: 'reel' }).textContent();
  check('the menu now shows it is in the reel (got: ' + reelLbl.trim() + ')',
    /✓ In reel/.test(reelLbl));

  // ---- ▶ Play from the menu starts the loop ----
  await page.locator('#mmRow button', { hasText: 'Play' }).click();
  await page.waitForTimeout(200);
  check('Play from the menu starts the clip', await page.evaluate(() =>
    !document.querySelector('#video').paused));
  await page.evaluate(() => document.querySelector('#video').pause());

  // ---- leaving hides it; the plain seek click is untouched ----
  await page.mouse.move(10, 10);
  await page.waitForTimeout(450);
  check('moving away hides the menu', !(await menuVisible()));

  const tl = await page.locator('#timeline').boundingBox();
  const b = await bar().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
  const t = await page.evaluate(() => document.querySelector('#video').currentTime);
  check('clicking the block still seeks there (t=' + t.toFixed(2) + ')', t > 1.7 && t < 4.3);

  // ---- the quick-mark chips yield while over a clip block ----
  await page.mouse.move(tl.x + tl.width * 0.75, b.y + b.height / 2);  // empty timeline
  await page.waitForTimeout(120);
  const chipsOnEmpty = await page.evaluate(() =>
    document.querySelector('#tlHover').style.display === 'flex');
  check('quick-mark chips show over empty timeline', chipsOnEmpty);
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(120);
  const chipsOnBar = await page.evaluate(() =>
    document.querySelector('#tlHover').style.display === 'flex');
  check('chips hide over a clip block — that hover belongs to the menu', !chipsOnBar);

  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));   // page exceptions fail the suite too
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
