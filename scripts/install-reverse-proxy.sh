#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

DEFAULT_HOSTNAME="$(hostname -f 2>/dev/null || hostname)"
if [[ "$DEFAULT_HOSTNAME" != *.* ]]; then
  DEFAULT_HOSTNAME="${DEFAULT_HOSTNAME}.local"
fi
HOSTNAME="${UI24R_HOSTNAME:-$DEFAULT_HOSTNAME}"
TARGET="${TARGET:-127.0.0.1:3001}"

MDNS_ALIAS_FILE="/etc/ui24r-mini-mixer/mdns-aliases"

ENV_FILE="${ENV_FILE:-${REPO_ROOT}/.env}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Please run as root (sudo $0)"
  exit 1
fi

apt-get update
apt-get install -y caddy avahi-daemon

normalize_list() {
  local input="$1"
  input="${input//,/ }"
  read -r -a _list <<< "$input"
}

SITES=("http://${HOSTNAME}")
if [[ "$HOSTNAME" == *.local ]]; then
  SITES+=("http://${HOSTNAME%.local}")
fi

NEED_MDNS=false
if [[ "$HOSTNAME" == *.local ]]; then
  NEED_MDNS=true
fi

if [[ "$NEED_MDNS" == true ]]; then
  MDNS_HOSTNAME="${MDNS_HOSTNAME:-${HOSTNAME%.local}}"

  if [[ -n "${MDNS_HOSTNAME:-}" ]]; then
    hostnamectl set-hostname "$MDNS_HOSTNAME"
    sed -i "s/^127\\.0\\.1\\.1.*/127.0.1.1 ${MDNS_HOSTNAME}/" /etc/hosts || true
  fi

  if [[ -f "$MDNS_ALIAS_FILE" ]]; then
    rm -f "$MDNS_ALIAS_FILE"
  fi

  if [[ -f /etc/avahi/hosts ]]; then
    TMP_HOSTS="$(mktemp)"
    awk '!/^# managed-by-ui24r-mini-mixer$/ && !/^# end-managed-by-ui24r-mini-mixer$/' /etc/avahi/hosts > "$TMP_HOSTS"
    mv "$TMP_HOSTS" /etc/avahi/hosts
    chmod 644 /etc/avahi/hosts || true
  fi

  systemctl enable avahi-daemon
  systemctl restart avahi-daemon
fi

cat > /etc/caddy/Caddyfile <<EOF
${SITES[*]} {
  reverse_proxy ${TARGET}
}
EOF

systemctl enable caddy
systemctl restart caddy

echo "Reverse proxy configured:"
echo "- App: ${SITES[*]} -> ${TARGET}"
