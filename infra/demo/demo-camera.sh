#!/usr/bin/env bash
# Publishes one synthetic demo camera to MediaMTX: court-N.mp4 looped as path court-demo-N.
# Stream copy (no re-encode), so it costs almost no CPU. MediaMTX records it like a real
# camera, so live view, recording and replay clips all go through the real pipeline.
# Usage: demo-camera.sh N   (CAMERA_USER / CAMERA_PASS from infra/.env)
set -euo pipefail
N=${1:?court number}
VIDEO=${DEMO_VIDEO_DIR:-/opt/padel/data/demo/video}/court-$N.mp4
exec ffmpeg -hide_banner -loglevel warning -re -stream_loop -1 -fflags +genpts -i "$VIDEO" \
  -c copy -f flv "rtmp://127.0.0.1:1935/court-demo-$N?user=$CAMERA_USER&pass=$CAMERA_PASS"
