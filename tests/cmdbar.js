/* The ⌘K command bar: a router over the buttons that already exist. Verifies it
   opens from anywhere, finds actions by their plain words, runs the SAME handlers
   the buttons run, respects the keyboard guards, and never stacks over a dialog. */
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

let errors = 0;
const check = (name, ok) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) errors++; };

(async () => {
  const { browser, page, errors: pageErrors } = await launch();
  await page.goto(APP);
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();

  const barOpen = () => page.evaluate(() =>
    document.querySelector('#cmdModal').classList.contains('open'));

  // ---- opens and closes, before any video is loaded ----
  await page.keyboard.press('Control+KeyK');
  check('Ctrl+K opens the command bar', await barOpen());
  check('the input has focus straight away', await page.evaluate(() =>
    document.activeElement === document.querySelector('#cmdInput')));
  const rows = await page.locator('#cmdList .cmdRow').count();
  check('suggestions show before typing (' + rows + ' rows)', rows > 0);
  await page.keyboard.press('Control+KeyK');
  check('Ctrl+K again closes it', !(await barOpen()));
  await page.keyboard.press('Control+KeyK');
  await page.keyboard.press('Escape');
  check('Esc closes it', !(await barOpen()));

  // ---- typed queries find actions by their plain words ----
  await page.keyboard.press('Control+KeyK');
  await page.type('#cmdInput', 'help');
  const first = await page.locator('#cmdList .cmdRow.sel .lbl').textContent();
  check('typing "help" surfaces Help first (got: ' + first.trim() + ')',
    /help/i.test(first));
  await page.keyboard.press('Enter');
  check('Enter runs it — the Help dialog is open', await page.evaluate(() =>
    document.querySelector('#helpModal').classList.contains('open')));
  check('running a command closed the bar', !(await barOpen()));

  // ---- never stacks over another open dialog ----
  await page.keyboard.press('Control+KeyK');
  check('Ctrl+K does nothing while another dialog is open', !(await barOpen()));
  await page.click('#helpClose');

  // ---- with a game loaded: marks, tabs and clip playback route through real handlers ----
  await page.setInputFiles('#fileVideo', path.join(FIXTURES, 'game.webm'));
  await page.waitForFunction(() => {
    const v = document.querySelector('#video');
    return v && v.duration > 5;
  });
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });

  await page.keyboard.press('Control+KeyK');
  await page.type('#cmdInput', 'start clip');
  await page.keyboard.press('Enter');
  const io = await page.evaluate(() => document.querySelector('#tlInOut').style.display);
  check('"start clip" set the in-mark through the real button', io === 'block');

  await page.keyboard.press('Control+KeyK');
  await page.type('#cmdInput', 'go to clips');
  await page.keyboard.press('Enter');
  check('"go to clips" switched the sidebar tab', await page.evaluate(() =>
    document.querySelector('#panel-clips').classList.contains('active')));

  // a saved clip becomes a typed-for entry
  await page.evaluate(() => {
    document.querySelector('#video').currentTime = 3;
    document.querySelector('#btnMarkOut').click();
  });
  await page.keyboard.press('Enter');            // open the save dialog
  await page.fill('#clipTitle', 'Great first touch');
  await page.click('#clipSave');
  await page.keyboard.press('Control+KeyK');
  await page.type('#cmdInput', 'great first');
  const clipRow = await page.locator('#cmdList .cmdRow.sel .lbl').textContent();
  check('a saved clip can be typed for (got: ' + clipRow.trim() + ')',
    /Great first touch/.test(clipRow));
  await page.keyboard.press('Enter');
  check('running the clip entry starts the loop playback', await page.evaluate(() =>
    !document.querySelector('#video').paused));

  // ---- arrow keys move the selection ----
  await page.keyboard.press('Control+KeyK');
  await page.keyboard.press('ArrowDown');
  const selIdx = await page.evaluate(() =>
    [...document.querySelectorAll('#cmdList .cmdRow')].findIndex(r => r.classList.contains('sel')));
  check('arrow keys move the highlighted row (index ' + selIdx + ')', selIdx === 1);
  await page.keyboard.press('Escape');

  // ---- a control hidden by feature detection is not offered as a command ----
  // (Safari hides 📁 Games because the folder API is missing — ⌘K must not
  //  route to a feature the browser cannot support)
  const gamesHidden = await page.evaluate(() => {
    const el = document.querySelector('#btnLibrary');
    const was = el.style.display;
    el.style.display = 'none';
    const offered = cmdEntries().some(e => e.label.includes('Games'));
    el.style.display = was;
    return { offered, back: cmdEntries().some(e => e.label.includes('Games')) };
  });
  check('a feature-hidden control is not offered', !gamesHidden.offered);
  check('it returns once the control is shown again', gamesHidden.back);

  // ---- the plain K shortcut still plays/pauses (no conflict with ⌘K) ----
  await page.evaluate(() => document.querySelector('#video').pause());
  await page.keyboard.press('KeyK');
  check('plain K still toggles play', await page.evaluate(() =>
    !document.querySelector('#video').paused));

  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));   // page exceptions fail the suite too
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
