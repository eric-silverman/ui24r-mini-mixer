#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="ui24r-mini-mixer"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_FILE="/etc/${SERVICE_NAME}.env"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Please run as root (sudo $0)"
  exit 1
fi

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Ui24R Mini Mixer
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${REPO_ROOT}
Environment=NODE_ENV=production
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/npm run start:prod
Restart=on-failure
RestartSec=3
User=${SUDO_USER:-root}

[Install]
WantedBy=multi-user.target
EOF

if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<EOF
# Optional mixer IP. You can leave this blank and connect from the UI.
MIXER_HOST=
EOF
fi

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "Installed and started ${SERVICE_NAME}."
echo "Edit ${ENV_FILE} to set MIXER_HOST later, then run: sudo systemctl restart ${SERVICE_NAME}"
