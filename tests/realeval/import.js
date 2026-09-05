#!/usr/bin/env node
/*
  Build eval cases straight from a Games folder (e.g. iCloud Drive/Game-Film).

  The app writes each game's project next to its video in the Games folder
  (<video>.filmroom.json — v2.1 continuity), so a folder a parent has already
  worked in IS a set of eval cases waiting to be named. This walks the folder,
  and for every project that holds a hand-tracked ring (a spotlight with at
  least MIN_KEYS keys) and sits next to its raw video, makes
    clips/<case-name>/  ->  a symlink to the video + a copy of the project
  Nothing is copied but the small JSON; the footage stays where it is.

  Usage:
    node realeval/import.js "/path/to/Game-Film"            # scan + create
    node realeval/import.js "/path/to/Game-Film" --dry-run  # only say what it would do

  Skipped, with the reason printed: projects with no hand-tracked ring, videos
  with no project, iCloud placeholders that are not downloaded yet (open the
  folder in Finder and let the cloud icons finish), and screen recordings of
  ANNOTATED exports (a burned-in ring falsifies the eval — README.md). Then:
    ./realeval/prep.sh              # or set CHROME_PATH to real Chrome and skip this
    node realeval/run.js --path detect --gate
*/
'use strict';
const fs = require('fs');
const path = require('path');

const MIN_KEYS = 8;               // fewer than this is a placed ring, not a tracked path
const VIDEO_RE = /\.(mp4|mov|m4v|webm)$/i;
const root = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!root || !fs.existsSync(root)){
  console.log('usage: node realeval/import.js "/path/to/Game-Film" [--dry-run]');
  process.exit(2);
}
const clipsDir = path.join(__dirname, 'clips');
if (!dry) fs.mkdirSync(clipsDir, { recursive: true });

const safe = s => s.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60) || 'case';
let made = 0, skipped = 0;
const say = (tag, msg) => { console.log(`${tag.padEnd(6)} ${msg}`); if (tag === 'SKIP') skipped++; };

function walk(dir){
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const e of entries){
    const p = path.join(dir, e.name);
    if (e.isDirectory()){ if (!/^clips$|^node_modules$/.test(e.name)) walk(p); continue; }
    if (/^\./.test(e.name) && /\.icloud$/i.test(e.name)){
      say('SKIP', `${p} — still in iCloud, not on this Mac yet (download it in Finder first)`);
      continue;
    }
    if (!/\.filmroom\.json$/i.test(e.name)) continue;
    consider(p, dir);
  }
}

function consider(gtPath, dir){
  let proj;
  try { proj = JSON.parse(fs.readFileSync(gtPath, 'utf8')); } catch (e) { return say('SKIP', `${gtPath} — not readable as a project`); }
  const spots = (proj.annotations || []).filter(a => a.type === 'spot' && a.keys && a.keys.length >= MIN_KEYS &&
    !/^ball$/i.test((a.label || '').trim()));
  if (!spots.length) return say('SKIP', `${gtPath} — no hand-tracked ring (a spotlight with ${MIN_KEYS}+ keys is the ground truth)`);

  /* the raw video: the project's own videoName if it sits here, else the
     same basename with a video extension, else the only video in the folder */
  const files = fs.readdirSync(dir);
  const base = path.basename(gtPath).replace(/\.filmroom\.json$/i, '');
  let video = files.find(f => f === proj.videoName) ||
              files.find(f => VIDEO_RE.test(f) && f.replace(/\.[^.]+$/, '') === base) ||
              (files.filter(f => VIDEO_RE.test(f) && !/\.eval\.webm$/i.test(f)).length === 1
                ? files.find(f => VIDEO_RE.test(f) && !/\.eval\.webm$/i.test(f)) : null);
  if (!video) return say('SKIP', `${gtPath} — no video next to it (expected ${proj.videoName || base + '.mov/.mp4'})`);
  const videoPath = path.join(dir, video);
  const st = fs.statSync(videoPath);
  if (!st.size) return say('SKIP', `${videoPath} — empty file; iCloud has not downloaded it yet`);
  if (/screen ?rec/i.test(video) && /__/.test(video))
    return say('SKIP', `${videoPath} — looks like an ANNOTATED export; the ring must not be burned in`);

  const name = safe(path.basename(dir) === path.basename(root) ? base : path.basename(dir) + '-' + base);
  const caseDir = path.join(clipsDir, name);
  const best = spots.reduce((p, q) => (q.keys.length > p.keys.length ? q : p));
  const span = (best.keys[best.keys.length - 1].t - best.keys[0].t).toFixed(1);
  const others = spots.filter(s => s !== best).map(s => s.label || '(unlabelled)');
  if (dry){ made++; return say('WOULD', `${name}: ${video} + ${best.keys.length} keys on "${best.label || 'him'}" over ${span}s${others.length ? ', look-alikes: ' + others.join(', ') : ''}`); }
  fs.mkdirSync(caseDir, { recursive: true });
  const link = path.join(caseDir, video);
  try { fs.unlinkSync(link); } catch (e) {}
  fs.symlinkSync(videoPath, link);
  fs.copyFileSync(gtPath, path.join(caseDir, base + '.filmroom.json'));
  if (!fs.existsSync(path.join(caseDir, 'manifest.json')))
    fs.writeFileSync(path.join(caseDir, 'manifest.json'), JSON.stringify({
      notes: `imported from ${path.relative(root, dir) || '.'} on ${new Date().toISOString().slice(0, 10)}; ` +
             `${best.keys.length} hand keys on "${best.label || 'him'}" over ${span}s` }, null, 2) + '\n');
  made++;
  say('CASE', `${name}: ${video} + ${best.keys.length} keys on "${best.label || 'him'}" over ${span}s${others.length ? ', look-alikes: ' + others.join(', ') : ''}`);
}

walk(root);
console.log(`\n${dry ? 'would make' : 'made'} ${made} case${made === 1 ? '' : 's'}, skipped ${skipped}.`);
if (made && !dry) console.log(`next: ./realeval/prep.sh (or CHROME_PATH=... to real Chrome), then node realeval/run.js --path detect --gate`);
if (!made) console.log(`nothing usable: the gate needs a project with a hand-tracked ring saved NEXT TO its raw video (README.md, "Making a case").`);
