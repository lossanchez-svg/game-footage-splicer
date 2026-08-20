#!/bin/sh
# Prepares real eval clips for the test browser.
#
# 1. Unpacks any "Keep this game" bundle zips dropped into clips/ — each becomes
#    clips/<bundle-name>/ with its project.filmroom.json (the ground truth).
#    NOTE: the videos inside a bundle have the drawings BURNED IN, ring included,
#    so they must not be used as eval footage — add the raw game video (or an
#    unannotated trim of it) to the folder yourself. See README.md.
# 2. Transcodes H.264 footage (mp4/mov/m4v) to <name>.eval.webm next to the
#    original, because the bundled Playwright Chromium cannot decode H.264.
#    The runner prefers the .eval.webm automatically. Skipped when it already
#    exists. Needs ffmpeg on PATH, or FFMPEG=... pointing at one.
set -e
cd "$(dirname "$0")"
FFMPEG="${FFMPEG:-ffmpeg}"
mkdir -p clips

for z in clips/*.zip; do
  [ -e "$z" ] || continue
  d="clips/$(basename "$z" .zip)"
  echo "unpacking $z -> $d/"
  mkdir -p "$d"
  unzip -o -q "$z" -d "$d"
done

for v in clips/*/*.mp4 clips/*/*.mov clips/*/*.m4v clips/*/*.MP4 clips/*/*.MOV; do
  [ -e "$v" ] || continue
  out="${v%.*}.eval.webm"
  if [ -e "$out" ]; then continue; fi
  echo "transcoding $v -> $out (one-time; the test Chromium has no H.264)"
  "$FFMPEG" -y -i "$v" -c:v libvpx-vp9 -crf 18 -b:v 0 -an "$out"
done

echo "done. Run: node run.js"
