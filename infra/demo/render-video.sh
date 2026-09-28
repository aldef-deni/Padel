#!/usr/bin/env bash
# Renders the synthetic "camera" videos for the demo instance (no real footage needed):
# a top-down padel court with four players and a ball, club/court caption and a REC dot.
#   court-N.mp4          120 s seamless loop (all motion periods divide 120 s), streamed by demo-camera.sh
#   samples/clip-N-K.mp4 30 s cuts used as historical replay clips by the demo seed
# H.264 main, no B-frames, keyframe every 2 s (same requirements as real cameras).
# Usage: render-video.sh [out_dir] [seconds]
set -euo pipefail
OUT=${1:-/opt/padel/data/demo/video}
DUR=${2:-120}
FONT=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf
mkdir -p "$OUT/samples"

# name | turf | team A | team B | phase
COURTS=(
  "LAPANGAN 1|0x1d5b8f|0xe4572e|0xf4f1de|0"
  "LAPANGAN 2|0x2f7d4f|0xf2c14e|0x3d5a80|1.7"
  "LAPANGAN 3|0x2c4f9e|0xef476f|0x06d6a0|3.1"
)

circle() { # size color [inner_color] -> lavfi source of a round sprite
  local s=$1 c=$2 inner=${3:-} r
  r=$(awk "BEGIN{print ($1-1)/2}")
  if [[ -n $inner ]]; then
    echo "color=c=$inner:s=${s}x${s}:r=25,format=rgba,geq=r='if(lte(hypot(X-$r,Y-$r),$r-3),r(X,Y),255)':g='if(lte(hypot(X-$r,Y-$r),$r-3),g(X,Y),255)':b='if(lte(hypot(X-$r,Y-$r),$r-3),b(X,Y),255)':a='255*lte(hypot(X-$r,Y-$r),$r)'"
  else
    echo "color=c=$c:s=${s}x${s}:r=25,format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='$([[ $c == black* ]] && echo 90 || echo 255)*lte(hypot(X-$r,Y-$r),$r)'"
  fi
}

n=0
for spec in "${COURTS[@]}"; do
  n=$((n + 1))
  IFS='|' read -r label turf ta tb ph <<<"$spec"
  # Rally: ball crosses the net every 2.5 s; y and players drift on periods that divide 120 s.
  tri="abs(mod((t+$ph)/2.5,2)-1)"
  bx="360+560*$tri-w/2"
  hop="22*sin(PI*mod(t+$ph,2.5)/2.5)"
  by="360+165*sin(2*PI*19*(t+$ph)/120)"
  script=$(mktemp)
  cat >"$script" <<FG
color=c=0x141c2b:s=1280x720:r=25,
drawbox=x=118:y=88:w=1044:h=544:color=0x9cc9ff@0.35:t=3,
drawbox=x=140:y=110:w=1000:h=500:color=$turf:t=fill,
drawbox=x=140:y=110:w=1000:h=500:color=white@0.85:t=3,
drawbox=x=292:y=110:w=3:h=500:color=white@0.8:t=fill,
drawbox=x=985:y=110:w=3:h=500:color=white@0.8:t=fill,
drawbox=x=292:y=359:w=696:h=3:color=white@0.8:t=fill,
drawbox=x=638:y=96:w=5:h=528:color=white:t=fill,
drawbox=x=640:y=96:w=1:h=528:color=black@0.35:t=fill[court];
$(circle 44 "$ta" "$ta")[a1]; $(circle 44 "$ta" "$ta")[a2];
$(circle 44 "$tb" "$tb")[b1]; $(circle 44 "$tb" "$tb")[b2];
$(circle 16 black)[shadow]; $(circle 16 0xf5e663)[ball];
[court][a1]overlay=x='305+45*sin(2*PI*13*(t+$ph)/120)-w/2':y='245+55*sin(2*PI*7*(t+$ph)/120)-h/2':eval=frame[s1];
[s1][a2]overlay=x='335+40*sin(2*PI*11*(t+$ph)/120)-w/2':y='475+55*sin(2*PI*9*(t+$ph)/120)-h/2':eval=frame[s2];
[s2][b1]overlay=x='975+40*sin(2*PI*17*(t+$ph)/120)-w/2':y='245+55*sin(2*PI*5*(t+$ph)/120)-h/2':eval=frame[s3];
[s3][b2]overlay=x='945+45*sin(2*PI*8*(t+$ph)/120)-w/2':y='475+55*sin(2*PI*14*(t+$ph)/120)-h/2':eval=frame[s4];
[s4][shadow]overlay=x='$bx+6':y='$by-h/2+6':eval=frame[s5];
[s5][ball]overlay=x='$bx':y='$by-$hop-h/2':eval=frame,
drawbox=x=24:y=22:w=390:h=44:color=black@0.55:t=fill,
drawtext=fontfile=$FONT:text='PADEL REPLAY  •  $label':x=40:y=34:fontsize=20:fontcolor=white,
drawtext=fontfile=$FONT:text='● REC':x=w-130:y=34:fontsize=22:fontcolor=0xff3b30:enable='lt(mod(t,1),0.6)',
drawtext=fontfile=$FONT:text='CAM $n  •  1280×720  •  25 fps':x=w-330:y=h-44:fontsize=16:fontcolor=white@0.75,
noise=alls=5:allf=t,format=yuv420p[out]
FG
  ffmpeg -hide_banner -loglevel error -y -filter_complex_script "$script" -map '[out]' -t "$DUR" \
    -c:v libx264 -preset slow -crf 23 -profile:v main -bf 0 -g 50 -keyint_min 50 -sc_threshold 0 \
    -movflags +faststart "$OUT/court-$n.mp4"
  rm -f "$script"
  if ((DUR >= 110)); then
    k=0
    for start in 4 40 76; do
      k=$((k + 1))
      ffmpeg -hide_banner -loglevel error -y -ss "$start" -i "$OUT/court-$n.mp4" -t 30 -c copy \
        -movflags +faststart "$OUT/samples/clip-$n-$k.mp4"
    done
  fi
  echo "court-$n.mp4 selesai"
done
