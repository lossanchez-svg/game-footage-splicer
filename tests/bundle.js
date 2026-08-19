/*
  Season bundles: one zip holding everything a game produced. The archive is
  written by hand (stored entries, no dependencies), so the test opens the
  result with a REAL unzip — a zip only this app can read would be worthless
  for archiving.
*/
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { APP, FIXTURES, OUT, launch } = require('./common');

const VIDEO = path.join(FIXTURES, 'game.webm');

const saveClip = async (page, title, at, notes, rating) => {
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at);
  await page.waitForTimeout(140);
  await page.click('#btnMarkIn');
  await page.evaluate(t => { document.querySelector('#video').currentTime = t; }, at + 2);
  await page.waitForTimeout(140);
  await page.click('#btnMarkOut');
  await page.click('#btnSaveClip');
  await page.waitForSelector('#clipModal.open');
  await page.fill('#clipTitle', title);
  if (notes) await page.fill('#clipNotes', notes);
  if (rating) await page.click(`#ratingRow [data-rating=${rating}]`);
  await page.click('#clipSave');
  await page.waitForTimeout(250);
};

(async () => {
  const { browser, page, errors, check } = await launch();

  await page.goto(APP);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('filmroom:tourDone', '1'); });
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.waitForFunction(() => document.querySelector('#video').duration > 9);

  // a game with something of everything in it
  await saveClip(page, 'Great scan', 1, 'Head up before it arrives, "checks", then plays', 'positive');
  await saveClip(page, 'Heavy touch', 4, '', 'negative');
  await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    p.sessions = [{ when: '2026-03-02', title: 'Week 1',
      entries: [{ clipId: p.clips[0].id, title: 'Great scan',
                  question: 'What did you see first?', answer: 'their six was stepping' }],
      wentWell: ['scanned early'], workOn: 'first touch toward space' }];
  });
  await page.click('#btnBoard');            // a board to pack
  await page.waitForTimeout(700);
  await page.click('#boardClose');
  await page.waitForTimeout(300);

  // ---- the offer ----
  await page.click('#btnBundle');
  await page.waitForSelector('#bundleModal.open');
  const what = await page.textContent('#bundleWhat');
  check('the offer says what is going in (' + what.replace(/\s+/g, ' ').slice(0, 60) + '…)',
    /2 moments/.test(what) && /1 session/.test(what) && /voice-overs/.test(what));
  check('videos are opt-in, not the default',
    await page.evaluate(() => !document.querySelector('#bundleVideos').checked));
  check('and the offer says what adding them costs',
    /minute/.test(await page.textContent('#bundleVideosNote')));

  const [dl] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#bundleSave'),
  ]);
  const zipPath = path.join(OUT, 'bundle.zip');
  await dl.saveAs(zipPath);
  check('the bundle is named for the game (' + dl.suggestedFilename() + ')',
    /game.*\.zip$/.test(dl.suggestedFilename()));

  // ---- a REAL unzip has to be able to read it ----
  let listing = '';
  try {
    listing = execFileSync('unzip', ['-l', zipPath], { encoding: 'utf8' });
    check('a real unzip reads the archive', true);
  } catch (e) {
    check('a real unzip reads the archive — ' + e.message, false);
  }
  try {
    const t = execFileSync('unzip', ['-t', zipPath], { encoding: 'utf8' });
    check('every checksum in it is correct', /No errors detected/i.test(t));
  } catch (e) {
    check('every checksum in it is correct — ' + e.message, false);
  }

  const outDir = path.join(OUT, 'bundle');
  fs.rmSync(outDir, { recursive: true, force: true });
  execFileSync('unzip', ['-q', '-o', zipPath, '-d', outDir]);
  const has = f => fs.existsSync(path.join(outDir, f));

  check('it explains itself to whoever opens it later', has('README.txt'));
  check('the project is in it', has('project.filmroom.json'));
  check('the moments are in it as a spreadsheet', has('moments.csv'));
  check('his answers are in it',
    fs.existsSync(path.join(outDir, 'sessions')) &&
    fs.readdirSync(path.join(outDir, 'sessions')).length === 1);
  check('the boards are in it as pictures',
    fs.existsSync(path.join(outDir, 'boards')) &&
    fs.readdirSync(path.join(outDir, 'boards')).some(f => f.endsWith('.png')));
  check('no clips folder when the videos were not asked for', !has('clips'));

  // ---- the contents are actually usable ----
  const proj = JSON.parse(fs.readFileSync(path.join(outDir, 'project.filmroom.json'), 'utf8'));
  check('the packed project holds the clips (' + proj.clips.length + ')', proj.clips.length === 2);
  check('and the tag vocabulary travels with it', Array.isArray(proj.taxonomy));

  const csv = fs.readFileSync(path.join(outDir, 'moments.csv'), 'utf8');
  check('the spreadsheet spells ratings out rather than storing code words',
    /,Strength,/.test(csv) && /,Work-on,/.test(csv) &&
    !/positive|negative|neutral/.test(csv));
  check('and quotes a note containing commas and quotes correctly',
    csv.includes('"Head up before it arrives, ""checks"", then plays"'));

  const readme = fs.readFileSync(path.join(outDir, 'README.txt'), 'utf8');
  check('the readme says how to get the work back',
    /Load project/.test(readme) && /2 moments saved/.test(readme));
  check('and says the game video is deliberately not inside',
    /NOT IN HERE/.test(readme));

  const board = fs.readFileSync(path.join(outDir, 'boards',
    fs.readdirSync(path.join(outDir, 'boards'))[0]));
  check('the board picture is a real PNG (' + board.length + ' bytes)',
    board.length > 1000 && board[0] === 0x89 && board.slice(1, 4).toString() === 'PNG');

  // ---- the packed project loads back into the app ----
  await page.reload();
  await page.setInputFiles('#fileVideo', VIDEO);
  await page.waitForSelector('#videoWrap', { state: 'visible' });
  await page.evaluate(() => {
    const p = window.__filmroom.getProject();
    p.clips = []; p.sessions = [];
  });
  await page.setInputFiles('#fileProj', path.join(outDir, 'project.filmroom.json'));
  await page.waitForTimeout(500);
  check('loading the packed project restores the game', await page.evaluate(() =>
    window.__filmroom.getProject().clips.length === 2));

  // ---- a voice-over is the one thing that lives nowhere else ----
  const withVoice = await page.evaluate(async () => {
    const p = window.__filmroom.getProject();
    const id = p.clips[0].id;
    const wav = new Blob([new Uint8Array(2048)], { type: 'audio/webm' });
    await window.__filmroom.saveVoice(id, wav);
    return window.__filmroom.voiceIds.has(id);
  });
  check('a recording exists to be packed', withVoice);
  await page.click('#btnBundle');
  await page.waitForSelector('#bundleModal.open');
  const [dl2] = await Promise.all([
    page.waitForEvent('download', { timeout: 60000 }),
    page.click('#bundleSave'),
  ]);
  const zip2 = path.join(OUT, 'bundle2.zip');
  await dl2.saveAs(zip2);
  const listing2 = execFileSync('unzip', ['-l', zip2], { encoding: 'utf8' });
  check('the voice-over travels in the bundle', /voice\//.test(listing2));

  console.log('\n--- errors collected:', errors.length);
  errors.forEach(e => console.log('  ', e));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
