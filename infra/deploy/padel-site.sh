#!/usr/bin/env bash
# Turn the Padel Replay sites off/on (production, demo, or both).
#
#   padel-site status
#   padel-site off demo|prod|all   # "sedang tidak aktif" page (503) + stop the services
#   padel-site on  demo|prod|all   # start the services, wait until healthy, open the site
#
# Off keeps DNS, TLS certificates (renewal still works) and all data. The marker file
# /opt/padel/data/maintenance/<site> makes nginx serve infra/deploy/maintenance.html.
# Postgres, Redis and MediaMTX (Docker) stay up: both sites share them and real cameras keep recording.
set -euo pipefail

FLAGS=/opt/padel/data/maintenance
declare -A HOST=([prod]=padel.aldeftech.com [demo]=demo.padel.aldeftech.com)
declare -A PORT=([prod]=3000 [demo]=3001)
declare -A UNITS=(
  [prod]="padel-api"
  [demo]="padel-api-demo padel-demo-camera@1 padel-demo-camera@2 padel-demo-camera@3 padel-demo-reset.timer"
)

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

sites() {
  case "${1:-}" in
    prod | demo) echo "$1" ;;
    all) echo "prod demo" ;;
    *) usage ;;
  esac
}

status() {
  for site in prod demo; do
    local state="AKTIF" units=""
    [[ -f $FLAGS/$site ]] && state="NONAKTIF"
    for unit in ${UNITS[$site]}; do units+=" $unit=$(systemctl is-active "$unit" 2>/dev/null || true)"; done
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "https://${HOST[$site]}/" || echo "000")
    printf '%-5s %-9s https://%s -> HTTP %s\n      %s\n' "$site" "$state" "${HOST[$site]}" "$code" "${units# }"
  done
}

off() {
  local site=$1
  mkdir -p "$FLAGS"
  touch "$FLAGS/$site" # page goes down first, so visitors never see a broken app
  # disable --now: stays off after a server reboot too.
  sudo systemctl disable --now ${UNITS[$site]} >/dev/null 2>&1
  echo "✓ $site nonaktif: https://${HOST[$site]} menampilkan halaman 'sedang tidak aktif'"
}

on() {
  local site=$1
  sudo systemctl enable --now ${UNITS[$site]} >/dev/null 2>&1
  echo -n "  menunggu API $site siap"
  for _ in $(seq 1 60); do
    if curl -sf -o /dev/null --max-time 2 "http://127.0.0.1:${PORT[$site]}/api/health"; then
      rm -f "$FLAGS/$site"
      echo
      echo "✓ $site aktif: https://${HOST[$site]}"
      return
    fi
    echo -n "."
    sleep 1
  done
  echo
  echo "✗ API $site belum sehat setelah 60 detik; situs tetap nonaktif. Cek: journalctl -u ${UNITS[$site]%% *} -n 50" >&2
  return 1
}

case "${1:-}" in
  status) status ;;
  off) for site in $(sites "${2:-}"); do off "$site"; done ;;
  on) for site in $(sites "${2:-}"); do on "$site"; done ;;
  *) usage ;;
esac
