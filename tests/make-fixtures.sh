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

# 8s two-player fixture for multi-spotlight tracking: a red 36px ball
# (center x = 58+40t, y = 180+60*sin t) and a blue one going the other way
# (center x = 578-45t, y = 108+50*cos 1.1t), on plain green.
"$FFMPEG" -y -f lavfi -i color=c=0x2f7d31:s=640x360:r=30:d=8 \
  -f lavfi -i color=c=0xd03030:s=36x36:r=30:d=8 \
  -f lavfi -i color=c=0x3050d0:s=36x36:r=30:d=8 \
  -filter_complex "[0][1]overlay=x='40+40*t':y='162+60*sin(t)'[a];[a][2]overlay=x='560-45*t':y='90+50*cos(1.1*t)'" \
  -c:v libvpx-vp9 -b:v 500k fixtures/two.webm

# 8s "small player" fixture — the shape of the real-world failure reported from
# a Trace/iPhone sideline clip: the player is TINY (8x20) next to a default ring,
# the grass is mown-striped and noisy, and two look-alikes cross his path
# (a same-colour team-mate running the other way, and a light-shirted player).
"$FFMPEG" -y -f lavfi -i "nullsrc=s=640x360:r=30:d=8,geq=r='38+9*sin(Y/7)':g='118+20*sin(Y/7)':b='48+7*sin(Y/7)'" \
  -f lavfi -i "color=c=0xc02828:s=8x20:r=30:d=8" \
  -f lavfi -i "color=c=0xc02828:s=8x20:r=30:d=8" \
  -f lavfi -i "color=c=0xd8d8d8:s=8x20:r=30:d=8" \
  -filter_complex "[0][1]overlay=x='70+58*t':y='150+22*sin(1.5*t)'[a];\
[a][2]overlay=x='520-40*t':y='120+18*cos(1.2*t)'[b];\
[b][3]overlay=x='300+15*t':y='230+10*sin(t)'[c];\
[c]noise=alls=7:allf=t" \
  -c:v libvpx-vp9 -b:v 900k fixtures/small.webm

# 8s PANNING-camera fixture: the world is wider than the frame and the window
# sweeps across it, so the grass streams past while the player drifts only
# slowly within the frame — the case where a grass-heavy template would happily
# follow the field instead of the player.
"$FFMPEG" -y -f lavfi -i "nullsrc=s=1800x420:r=30:d=8,geq=r='38+9*sin(X/23)+6*sin(Y/7)':g='118+16*sin(X/23)+18*sin(Y/7)':b='48+6*sin(X/23)+6*sin(Y/7)'" \
  -f lavfi -i "color=c=0xc02828:s=8x20:r=30:d=8" \
  -f lavfi -i "color=c=0xd8d8d8:s=8x20:r=30:d=8" \
  -filter_complex "[0][1]overlay=x='260+70*t':y='200+15*sin(2*t)'[a];\
[a][2]overlay=x='420+64*t':y='250+12*cos(1.7*t)'[b];\
[b]noise=alls=7:allf=t,crop=640:360:x='120+55*t':y=30" \
  -c:v libvpx-vp9 -b:v 1000k fixtures/pan.webm

# 8s "tree line" fixture: a high-contrast canopy sits directly ABOVE the players,
# as on a real park pitch. The tracking patch is square while the ring is drawn
# flat, so a patch centred on a player near that line reaches up into the canopy
# — and canopy has far more contrast than the player or the grass.
"$FFMPEG" -y -f lavfi -i "nullsrc=s=640x360:r=30:d=8,geq=\
r='if(lt(Y,130), 18+34*sin(X/5)*sin(Y/4), 38+9*sin(Y/7))':\
g='if(lt(Y,130), 42+46*sin(X/7)*cos(Y/5), 118+20*sin(Y/7))':\
b='if(lt(Y,130), 16+24*sin(X/3)*sin(Y/6), 48+7*sin(Y/7))'" \
  -f lavfi -i "color=c=0xc02828:s=8x20:r=30:d=8" \
  -filter_complex "[0][1]overlay=x='80+60*t':y='136+6*sin(2*t)'[a];[a]noise=alls=6:allf=t" \
  -c:v libvpx-vp9 -b:v 900k fixtures/trees.webm

# 4s of real AAC (ADTS) for the muxer/demuxer audio suite
"$FFMPEG" -y -f lavfi -i sine=frequency=600:duration=4 -c:a aac -b:a 96k \
  -f adts fixtures/clip.aac

echo "fixtures ready:"
ls -la fixtures

# 8s "runs out of shot" fixture: the player crosses to the right and leaves the
# frame entirely at about t=5. There is nothing to track after that, and the
# honest outcome is to stop and say so. The failure this guards against is the
# tracker "finding" him past the edge of the picture: nccAt clamps its reads, so
# the last row of pixels smears outward and correlates with itself, giving a
# confident-looking match at a position that is not in the picture at all.
"$FFMPEG" -y -f lavfi -i "nullsrc=s=640x360:r=30:d=8,geq=r='38+9*sin(Y/7)+5*sin(X/29)':g='118+20*sin(Y/7)+12*sin(X/29)':b='48+7*sin(Y/7)'" \
  -f lavfi -i "color=c=0xc02828:s=8x20:r=30:d=8" \
  -filter_complex "[0][1]overlay=x='90+118*t':y='170+10*sin(1.8*t)'[a];[a]noise=alls=6:allf=t" \
  -c:v libvpx-vp9 -b:v 900k fixtures/exit.webm

# 8s "faint" fixture: the one that finally reproduced what a real report showed.
# Every earlier fixture used a high-contrast player on plain grass and scored a
# distinctiveness of 0.74-0.87 with match scores of 0.96+ — far easier than real
# far-sideline film, which measured 0.489. Here the players are muddy 5x13
# smudges barely separable from textured, noisy grass, and they cross each other
# at the same depth: at the default ring size the largest candidate patch scores
# 0.43, right in the range the real footage did.
"$FFMPEG" -y -f lavfi -i "nullsrc=s=640x360:r=30:d=8,geq=\
r='40+7*sin(X/9)+5*sin(Y/5)+4*sin((X+Y)/13)':\
g='120+26*sin(X/9)+16*sin(Y/5)+10*sin((X+Y)/13)':\
b='50+8*sin(X/9)+5*sin(Y/5)'" \
  -f lavfi -i "color=c=0x7a4038:s=5x13:r=30:d=8" \
  -f lavfi -i "color=c=0x74483a:s=5x13:r=30:d=8" \
  -f lavfi -i "color=c=0x6f4636:s=5x13:r=30:d=8" \
  -filter_complex "[0][1]overlay=x='100+42*t':y='190+9*sin(1.6*t)'[a];\
[a][2]overlay=x='430-46*t':y='196+7*cos(1.3*t)'[b];\
[b][3]overlay=x='250+8*t':y='214+5*sin(0.9*t)'[c];\
[c]noise=alls=11:allf=t" \
  -c:v libvpx-vp9 -b:v 1200k fixtures/faint.webm

# 8s "body" fixture: a player with an actual body — head, torso and two legs with
# a gap that opens and closes as he runs — rather than the solid blocks the other
# fixtures use. Same-kit team-mates cannot be told apart by colour, so shape is
# the only thing left, and a solid rectangle has no shape to find. A look-alike
# in the same kit crosses him at the same depth around t=5.
"$FFMPEG" -y -f lavfi -i "nullsrc=s=640x360:r=30:d=8,geq=r='42+8*sin(X/11)+5*sin(Y/6)':g='122+24*sin(X/11)+15*sin(Y/6)':b='52+9*sin(X/11)+5*sin(Y/6)'" \
  -f lavfi -i "color=c=0xd8b48c:s=4x4:r=30:d=8"  -f lavfi -i "color=c=0x8a2b2b:s=8x10:r=30:d=8" \
  -f lavfi -i "color=c=0x2f3a58:s=3x9:r=30:d=8"  -f lavfi -i "color=c=0x2f3a58:s=3x9:r=30:d=8" \
  -f lavfi -i "color=c=0xd8b48c:s=4x4:r=30:d=8"  -f lavfi -i "color=c=0x8a2b2b:s=8x10:r=30:d=8" \
  -f lavfi -i "color=c=0x2f3a58:s=3x9:r=30:d=8"  -f lavfi -i "color=c=0x2f3a58:s=3x9:r=30:d=8" \
  -filter_complex "\
[0][1]overlay=x='102+40*t':y='168+6*sin(1.5*t)'[a1];\
[a1][2]overlay=x='100+40*t':y='172+6*sin(1.5*t)'[a2];\
[a2][3]overlay=x='100+40*t+1+2*sin(9*t)':y='182+6*sin(1.5*t)'[a3];\
[a3][4]overlay=x='100+40*t+5-2*sin(9*t)':y='182+6*sin(1.5*t)'[a4];\
[a4][5]overlay=x='432-44*t':y='170+5*cos(1.2*t)'[b1];\
[b1][6]overlay=x='430-44*t':y='174+5*cos(1.2*t)'[b2];\
[b2][7]overlay=x='430-44*t+1-2*sin(8*t)':y='184+5*cos(1.2*t)'[b3];\
[b3][8]overlay=x='430-44*t+5+2*sin(8*t)':y='184+5*cos(1.2*t)'[b4];\
[b4]noise=alls=9:allf=t" \
  -c:v libvpx-vp9 -b:v 1200k fixtures/body.webm
