/*
  The v6-C gate: measure Auto-Cut proposals against the parent's own hand-set
  trims. For every saved clip in a hand-broken-down game, the experiment is:
  widen the clip by 3s each side (the loose cut a person starts from), ask the
  SHIPPED proposeCut() — running in the real page — to tighten it, and compare
  the proposal's ends with where the parent actually cut. Ship bar: median
  difference within 1.5s per end. Clips the assist has no opinion on (report
  gap, already short) are reported, not counted against it — a null is honest.

  Usage:
    node realeval/autocut.js                        # every clips/<case> with
                                                    # saved clips + a detect report
    node realeval/autocut.js <project.json> <report.json>
*/
const path = require('path');
const fs = require('fs');
const { launch } = require('../common');

const ROOT = __dirname;
const CLIPS = path.join(ROOT, 'clips');
const OUT = path.join(ROOT, 'out');
const APP = 'file://' + path.resolve(ROOT, '..', '..', 'index.html');

function gradeCuts(clips, proposals){
  const dIn = [], dOut = [];
  let noOpinion = 0;
  clips.forEach((c, i) => {
    const p = proposals[i];
    if (!p){ noOpinion++; return; }
    dIn.push(Math.abs(p.tIn - c.tIn));
    dOut.push(Math.abs(p.tOut - c.tOut));
  });
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
  return {
    clips: clips.length, proposed: dIn.length, noOpinion,
    medianIn: med(dIn) == null ? null : +med(dIn).toFixed(2),
    medianOut: med(dOut) == null ? null : +med(dOut).toFixed(2),
    ok: dIn.length > 0 && med(dIn) <= 1.5 && med(dOut) <= 1.5,
  };
}

async function main(){
  const args = process.argv.slice(2);
  const pairs = [];
  if (args.length >= 2){
    pairs.push({ name: path.basename(args[0]),
      proj: JSON.parse(fs.readFileSync(args[0], 'utf8')),
      report: JSON.parse(fs.readFileSync(args[1], 'utf8')) });
  } else {
    for (const name of (fs.existsSync(CLIPS) ? fs.readdirSync(CLIPS) : [])){
      const dir = path.join(CLIPS, name);
      if (!fs.statSync(dir).isDirectory()) continue;
      const gtFile = fs.readdirSync(dir).find(f => /\.filmroom\.json$/i.test(f));
      const repFile = path.join(OUT, name + '-detect-report.json');
      if (!gtFile || !fs.existsSync(repFile)) continue;
      const proj = JSON.parse(fs.readFileSync(path.join(dir, gtFile), 'utf8'));
      if (!(proj.clips || []).length){
        console.log(`SKIP  ${name}: the project has no saved clips — the gate measures against HIS trims`);
        continue;
      }
      pairs.push({ name, proj, report: JSON.parse(fs.readFileSync(repFile, 'utf8')) });
    }
  }
  if (!pairs.length){
    console.log('Nothing to grade yet. The v6-C gate measures Auto-Cut against hand-set');
    console.log('trims: it needs a project with saved clips plus a detection report over the');
    console.log('same span (see realeval/README.md, the Moment Finder gate section — the');
    console.log('same pairs feed both gates).');
    process.exit(0);
  }
  let bad = 0;
  const { browser, page } = await launch();
  try {
    await page.goto(APP);
    for (const p of pairs){
      const proposals = await page.evaluate(([clips, rep]) =>
        clips.map(c => window.__filmroom.proposeCut(
          { ...c, tIn: Math.max(0, c.tIn - 3), tOut: c.tOut + 3 }, rep)),
        [p.proj.clips, p.report]);
      const g = gradeCuts(p.proj.clips, proposals);
      const ok = g.ok;
      if (!ok) bad++;
      console.log(`${ok ? 'PASS' : 'FAIL'}  ${p.name}: proposed on ${g.proposed}/${g.clips} loosened clips` +
        ` (no opinion on ${g.noOpinion})  median off his cut: in ${g.medianIn}s / out ${g.medianOut}s (bar 1.5s)`);
    }
  } finally { await browser.close(); }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();
module.exports = { gradeCuts };
