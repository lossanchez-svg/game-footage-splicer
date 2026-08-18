#!/bin/sh
# Generates the test fixture videos into tests/fixtures/.
# Needs ffmpeg. If it's not on PATH, `pip install imageio-ffmpeg` and set FFMPEG to the
# binary it prints via: python3 -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
set -e
cd "$(dirname "$0")"
FFMPEG="${FFMPEG:-ffmpeg}"
mkdir -p fixtures

# 10s general-purpose test pattern with audio (WebM: the Playwright Chromium build has no H.264)
"$FFMPEG" -y -f lavfi -i testsrc=duration=10:size=640x360:rate=30 \
  -f lavfi -i sine=frequency=440:duration=10 \
  -c:v libvpx-vp9 -b:v 500k -c:a libopus -shortest fixtures/game.webm

# 8s tracking fixture: red 36px ball on plain green, moving on a curve —
# center x = 58+40t px, center y = 180+60*sin(t) px.
"$FFMPEG" -y -f lavfi -i color=c=0x2f7d31:s=640x360:r=30:d=8 \
  -f lavfi -i color=c=red:s=36x36:r=30:d=8 \
  -filter_complex "[0][1]overlay=x='40+40*t':y='162+60*sin(t)'" \
  -c:v libvpx-vp9 -b:v 400k fixtures/ball.webm

echo "fixtures ready:"
ls -la fixtures
