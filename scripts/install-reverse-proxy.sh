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
apt-get install -y caddy avahi-daemon dnsmasq

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

# Captive portal detection - respond to iOS/Android connectivity checks
# This prevents 30s delays on networks without internet
:80 {
  @captive_ios path /hotspot-detect.html /library/test/success.html
  handle @captive_ios {
    respond "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>" 200
  }

  @captive_android path /generate_204 /gen_204
  handle @captive_android {
    respond "" 204
  }

  @captive_windows path /ncsi.txt /connecttest.txt
  handle @captive_windows {
    respond "Microsoft NCSI" 200
  }

  # Fallback - redirect to main app
  handle {
    redir ${SITES[0]} temporary
  }
}
EOF

# Configure dnsmasq to intercept captive portal domains
PI_IP="$(hostname -I | awk '{print $1}')"
cat > /etc/dnsmasq.d/captive-portal.conf <<DNSEOF
# Redirect captive portal detection domains to this Pi
# This makes iOS/Android think they have internet connectivity
address=/captive.apple.com/${PI_IP}
address=/www.apple.com/${PI_IP}
address=/connectivitycheck.gstatic.com/${PI_IP}
address=/clients3.google.com/${PI_IP}
address=/msftncsi.com/${PI_IP}
address=/www.msftconnecttest.com/${PI_IP}
DNSEOF

# Ensure dnsmasq doesn't conflict with systemd-resolved
if systemctl is-active --quiet systemd-resolved; then
  systemctl stop systemd-resolved
  systemctl disable systemd-resolved
  rm -f /etc/resolv.conf
  echo "nameserver 127.0.0.1" > /etc/resolv.conf
fi

systemctl enable dnsmasq
systemctl restart dnsmasq

systemctl enable caddy
systemctl restart caddy

echo "Reverse proxy configured:"
echo "- App: ${SITES[*]} -> ${TARGET}"
echo "- Captive portal detection enabled (dnsmasq + caddy)"
echo ""
echo "IMPORTANT: Configure your mixer/router DHCP to use ${PI_IP} as the DNS server"
echo "           This allows iOS/Android devices to load instantly without internet."
