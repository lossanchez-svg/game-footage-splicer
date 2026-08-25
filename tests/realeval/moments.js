/*
  The v6-B gate: replay the Moment Finder over games the parent already broke
  down by hand, and ask the two questions that decide whether it ships ON:

  - recall: of the moments THEY chose (the project's saved clips), what share
    does some candidate overlap? Bar: ≥ 80%. The clips he already saved ARE
    the ground truth for "what this family calls a moment".
  - review cost: if they accepted exactly their own moments, how many
    candidates would they wade through per accept? Bar: ≤ 4 per chosen
    moment (≤ 3 rejects per accept), so review stays minutes per game.

  The candidates come from the SHIPPED momentCandidates() running in the real
  page (the kit-chapters lesson: never a second copy of the arithmetic).

  Usage:
    node realeval/moments.js                          # every clips/<case> with
                                                      # saved clips + a detect report
    node realeval/moments.js <project.json> <report.json>   # one explicit pair
*/
const path = require('path');
const fs = require('fs');
const { launch } = require('../common');

const ROOT = __dirname;
const CLIPS = path.join(ROOT, 'clips');
const OUT = path.join(ROOT, 'out');
const APP = 'file://' + path.resolve(ROOT, '..', '..', 'index.html');

const overlap = (clip, cand) => {
  const a = Math.max(clip.tIn, cand.start), b = Math.min(clip.tOut, cand.end);
  const ov = Math.max(0, b - a);
  return ov >= 0.5 || ov >= 0.3 * Math.max(0.1, clip.tOut - clip.tIn);
};

function gradeGame(clips, candidates){
  const hits = clips.filter(c => candidates.some(k => overlap(c, k)));
  const recall = clips.length ? hits.length / clips.length : null;
  const perAccept = hits.length ? candidates.length / hits.length : null;
  return {
    chosen: clips.length, candidates: candidates.length,
    hit: hits.length,
    missed: clips.filter(c => !candidates.some(k => overlap(c, k)))
      .map(c => ({ tIn: c.tIn, tOut: c.tOut, title: c.title })),
    recall: recall == null ? null : +recall.toFixed(3),
    candidatesPerAccept: perAccept == null ? null : +perAccept.toFixed(2),
    recallOk: recall != null && recall >= 0.8,
    costOk: perAccept != null && perAccept <= 4,
  };
}

async function candidatesFor(report){
  const { browser, page } = await launch();
  try {
    await page.goto(APP);
    return await page.evaluate(rep => window.__filmroom.moments.candidates(rep), report);
  } finally { await browser.close(); }
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
        console.log(`SKIP  ${name}: the project has no saved clips — the gate needs games broken down by hand`);
        continue;
      }
      pairs.push({ name, proj, report: JSON.parse(fs.readFileSync(repFile, 'utf8')) });
    }
  }
  if (!pairs.length){
    console.log('Nothing to grade yet. The v6-B gate runs over games already broken down by');
    console.log('hand: a project with his SAVED CLIPS plus a detection tracking report over');
    console.log('the same span. Save a full game project (💾) into a clips/<name>/ folder');
    console.log('next to its video and run `node realeval/run.js --path detect` first.');
    process.exit(0);
  }
  let bad = 0;
  for (const p of pairs){
    const cands = await candidatesFor(p.report);
    const g = gradeGame(p.proj.clips || [], cands);
    const ok = g.recallOk && g.costOk;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${p.name}: recall ${g.recall == null ? '-' : Math.round(g.recall * 100) + '%'} ` +
      `(${g.hit}/${g.chosen} of his moments surfaced; bar 80%)  ` +
      `review cost ${g.candidatesPerAccept} candidates per accept (bar ≤4)`);
    for (const m of g.missed)
      console.log(`      missed: ${m.tIn}s–${m.tOut}s  ${m.title || ''}`);
  }
  process.exit(bad ? 1 : 0);
}

if (require.main === module) main();
module.exports = { gradeGame, overlap };
