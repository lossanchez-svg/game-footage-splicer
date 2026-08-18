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

# 8s "hard mode" tracking fixture — approximates zoomed-out Trace/YouTube film:
# small 18px ball (center x = 49+55t, y = 180+50*sin(1.3t)), sensor noise on the
# whole frame, breathing exposure (brightness ±0.12), and a white 22px occluder
# (center x = 511-70t, y = 130) that crosses straight over the ball at t≈3.7.
"$FFMPEG" -y -f lavfi -i color=c=0x2f7d31:s=640x360:r=30:d=8 \
  -f lavfi -i color=c=0xd03030:s=18x18:r=30:d=8 \
  -f lavfi -i color=c=0xe8e8e8:s=22x22:r=30:d=8 \
  -filter_complex "[0][1]overlay=x='40+55*t':y='171+50*sin(1.3*t)'[a];[a][2]overlay=x='500-70*t':y=119[b];[b]noise=alls=8:allf=t,eq=brightness='0.12*sin(2*t)'" \
  -c:v libvpx-vp9 -b:v 700k fixtures/hard.webm

# 4s of real AAC (ADTS) for the muxer/demuxer audio suite
"$FFMPEG" -y -f lavfi -i sine=frequency=600:duration=4 -c:a aac -b:a 96k \
  -f adts fixtures/clip.aac

echo "fixtures ready:"
ls -la fixtures
