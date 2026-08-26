/* Smart-drop zones + drag-a-card-to-the-reel. The whole-document drop keeps its
   original behavior (including both failure toasts, word for word); the zones only
   refine where a drop lands once a game is open. */
const fs = require('fs');
const path = require('path');
const { APP, FIXTURES, launch } = require('./common');

let errors = 0;
const check = (name, ok) => { console.log((ok ? 'PASS  ' : 'FAIL  ') + name); if (!ok) errors++; };

(async () => {
  const { browser, page, errors: pageErrors } = await launch();
  await page.goto(APP);
  await page.evaluate(() => localStorage.setItem('filmroom:tourDone', '1'));
  await page.reload();

  const gameB64 = fs.readFileSync(path.join(FIXTURES, 'game.webm')).toString('base64');
  const drag = (type, x, y, files) => page.evaluate(({ type, x, y, files }) => {
    const dt = new DataTransfer();
    for (const f of files || []){
      const bytes = f.b64 ? Uint8Array.from(atob(f.b64), c => c.charCodeAt(0))
                          : new Uint8Array([1, 2, 3]);
      dt.items.add(new File([bytes], f.name, { type: f.mime }));
    }
    const ev = new DragEvent(type, { bubbles: true, cancelable: true,
      clientX: x, clientY: y, dataTransfer: dt });
    (document.elementFromPoint(x, y) || document.body).dispatchEvent(ev);
  }, { type, x, y, files });
  const zonesShowing = () => page.evaluate(() =>
    document.querySelector('#dropZones').style.display === 'block');
  const toastText = () => page.evaluate(() =>
    [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '));

  // ---- before any video: no zones, dropping a video just opens it (as always) ----
  await drag('dragenter', 400, 300, [{ name: 'g.webm', mime: 'video/webm' }]);
  check('no zones before a game is open', !(await zonesShowing()));
  await drag('dragover', 400, 300, [{ name: 'g.webm', mime: 'video/webm' }]);
  await drag('drop', 400, 300, [{ name: 'game one.webm', mime: 'video/webm', b64: gameB64 }]);
  await page.waitForFunction(() => {
    const v = document.querySelector('#video');
    return v && v.duration > 5;
  });
  check('dropping a video anywhere still opens it', true);

  // save one clip so the compare zone (and reel) have something to work with
  await page.evaluate(() => { document.querySelector('#video').currentTime = 2; });
  await page.click('#btnMarkIn');
  await page.evaluate(() => { document.querySelector('#video').currentTime = 4; });
  await page.click('#btnMarkOut');
  await page.keyboard.press('Enter');
  await page.fill('#clipTitle', 'Good pressing trigger');
  await page.click('#clipSave');
  await page.waitForTimeout(150);

  // ---- with a game open: zones appear, and the armed one highlights ----
  const stage = await page.locator('#stage').boundingBox();
  const cx = f => stage.x + stage.width * f, cy = stage.y + stage.height / 2;
  await drag('dragenter', cx(0.5), cy, [{ name: 'x.webm', mime: 'video/webm' }]);
  check('zones appear while dragging over an open game', await zonesShowing());
  const both = await page.evaluate(() =>
    !document.querySelector('#dropZones').classList.contains('solo'));
  check('with a saved clip, the example-side zone is offered too', both);
  await drag('dragover', cx(0.85), cy, [{ name: 'x.webm', mime: 'video/webm' }]);
  const hot = await page.evaluate(() =>
    document.querySelector('.dzCompare').classList.contains('hot'));
  check('the zone under the cursor arms (compare side hot)', hot);

  // ---- dropping on the example-side zone routes into Compare ----
  await drag('drop', cx(0.85), cy, [{ name: 'pro-model.webm', mime: 'video/webm', b64: gameB64 }]);
  await page.waitForTimeout(400);
  check('the drop opened side-by-side Compare', await page.evaluate(() =>
    document.querySelector('#compareBar').style.display === 'flex'));
  const lblB = await page.evaluate(() =>
    document.querySelector('#cmpLabelB').textContent);
  check('the dropped file is the example side (got: ' + lblB.trim() + ')',
    /pro-model/.test(lblB));
  check('zones cleaned up after the drop', !(await zonesShowing()));
  await page.click('#cmpClose');

  // ---- drag a clip card onto the Highlight reel section ----
  await page.click('#tabs button[data-tab=clips]');
  await page.locator('#clipList .clipItem').first().scrollIntoViewIfNeeded();
  const dot = await page.locator('#clipList .clipItem .dragDot').first().boundingBox();
  const reel = await page.locator('#reelSection').boundingBox();
  await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
  await page.mouse.down();
  await page.mouse.move(reel.x + reel.width / 2, reel.y + reel.height / 2, { steps: 8 });
  const hotReel = await page.evaluate(() =>
    document.querySelector('#reelSection').classList.contains('dropHot'));
  check('the reel section lights up while a card hovers it', hotReel);
  await page.mouse.up();
  await page.waitForTimeout(150);
  const reelLen = await page.evaluate(() =>
    (window.__filmroom.getProject().reel || []).length);
  check('dropping the card added the clip to the reel', reelLen === 1);
  const btnLbl = await page.locator('#clipList [data-act=reel]').first().textContent();
  check('the card’s own button now says it is in (got: ' + btnLbl.trim() + ')',
    /✓ In reel/.test(btnLbl));

  // ---- dropping on the open zone swaps the game (original behavior) ----
  await drag('dragenter', cx(0.3), cy, [{ name: 'y.webm', mime: 'video/webm' }]);
  await drag('dragover', cx(0.3), cy, [{ name: 'y.webm', mime: 'video/webm' }]);
  await drag('drop', cx(0.3), cy, [{ name: 'game two.webm', mime: 'video/webm', b64: gameB64 }]);
  await page.waitForTimeout(600);
  const vname = await page.evaluate(() => document.querySelector('#videoName').textContent);
  check('the open zone swapped to the new game (got: ' + vname + ')', /game two/.test(vname));

  // ---- both failure toasts survive, word for word ----
  await drag('dragenter', cx(0.5), cy, [{ name: 'photo.png', mime: 'image/png' }]);
  await drag('drop', cx(0.5), cy, [{ name: 'photo.png', mime: 'image/png' }]);
  await page.waitForTimeout(200);
  check('a non-video file still gets the plain-words toast',
    /isn’t a video this browser can read/.test(await toastText()));
  await drag('drop', cx(0.5), cy, []);
  await page.waitForTimeout(200);
  check('an empty drop still explains the Photos-app trap',
    /didn’t deliver a file/.test(await toastText()));

  await browser.close();
  pageErrors.forEach(e => console.log('  ', e));   // page exceptions fail the suite too
  console.log('\n--- errors collected: ' + (errors + pageErrors.length));
  process.exit((errors + pageErrors.length) ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
