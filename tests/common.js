const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const APP = 'file://' + path.resolve(__dirname, '..', 'index.html');
const FIXTURES = path.join(__dirname, 'fixtures');
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const roots = ['/opt/pw-browsers', process.env.PLAYWRIGHT_BROWSERS_PATH].filter(Boolean);
  for (const root of roots) {
    try {
      for (const d of fs.readdirSync(root)) {
        const p = path.join(root, d, 'chrome-linux', 'chrome');
        if (d.startsWith('chromium') && fs.existsSync(p)) return p;
      }
    } catch (e) {}
  }
  return undefined; // let playwright-core try its default resolution
}

async function launch(contextOpts = {}) {
  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ acceptDownloads: true, ...contextOpts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  const check = (name, cond) => {
    console.log((cond ? 'PASS' : 'FAIL') + '  ' + name);
    if (!cond) errors.push('CHECK FAIL: ' + name);
  };
  return { browser, page, errors, check };
}


/* v7 progressive disclosure: open every clip card's "More" fold and the top-bar
   Project menu so a test can click controls that now sit one disclosure deep.
   Opening fires each fold's toggle listener, so the app keeps them open across
   its own re-renders for the rest of the page session. */
async function openDisclosures(page) {
  await page.evaluate(() => {
    document.querySelectorAll('.clipItem details.moreActs').forEach(d => d.open = true);
    const m = document.querySelector('#projectMenu');
    if (m) m.open = true;
  });
}

module.exports = { APP, FIXTURES, OUT, launch, openDisclosures };
