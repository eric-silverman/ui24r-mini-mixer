#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="ui24r-mini-mixer"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEFAULT_INSTALL_DIR="/opt/ui24r-mini-mixer"
ENV_FILE="/etc/default/${SERVICE_NAME}"

if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
  echo "Please run as root (sudo $0)"
  exit 1
fi

prompt() {
  local var_name=$1
  local prompt_text=$2
  local default_value=$3
  local value

  read -r -p "${prompt_text} [${default_value}]: " value
  if [[ -z "${value}" ]]; then
    value="${default_value}"
  fi
  printf -v "${var_name}" "%s" "${value}"
}

echo "== Ui24R Mini Mixer Pi Bootstrap =="

prompt INSTALL_DIR "Install directory" "${DEFAULT_INSTALL_DIR}"
if [[ -d "${INSTALL_DIR}" ]]; then
  read -r -p "${INSTALL_DIR} exists. Overwrite contents? (y/N): " confirm
  if [[ "${confirm}" != "y" && "${confirm}" != "Y" ]]; then
    echo "Aborting."
    exit 1
  fi
fi

echo "Installing prerequisites..."
apt-get update -y
apt-get install -y curl ca-certificates python3 tar rsync

if ! command -v node >/dev/null; then
  echo "Installing Node.js 20 LTS..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "Syncing repo to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
rsync -a --delete \
  --exclude ".git" \
  --exclude "node_modules" \
  --exclude "client/node_modules" \
  --exclude "server/node_modules" \
  "${REPO_ROOT}/" "${INSTALL_DIR}/"

chmod +x "${INSTALL_DIR}/scripts/pi/update.sh"

echo "Configure environment values (press Enter to accept defaults)."
prompt UI24R_HOST "Mixer IP (UI24R_HOST)" "192.168.1.123"
prompt UI24R_CHANNELS "Channel range (UI24R_CHANNELS)" "1-24"
prompt GITHUB_REPO "GitHub repo (GITHUB_REPO)" "your-org/ui24r-mini-mixer"
prompt ASSET_PREFIX "Release asset prefix (ASSET_PREFIX)" "ui24r-mini-mixer"
read -r -p "GitHub token (GITHUB_TOKEN, optional): " GITHUB_TOKEN

cat > "${ENV_FILE}" <<EOF
# Core app config
UI24R_HOST=${UI24R_HOST}
UI24R_CHANNELS=${UI24R_CHANNELS}

# Update checker config
GITHUB_REPO=${GITHUB_REPO}
INSTALL_DIR=${INSTALL_DIR}
SERVICE_NAME=${SERVICE_NAME}
ASSET_PREFIX=${ASSET_PREFIX}
EOF

if [[ -n "${GITHUB_TOKEN}" ]]; then
  echo "GITHUB_TOKEN=${GITHUB_TOKEN}" >> "${ENV_FILE}"
fi

echo "Installing systemd units..."
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Ui24R Mini Mixer
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}/server
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

cat > "/etc/systemd/system/${SERVICE_NAME}-update.service" <<EOF
[Unit]
Description=Ui24R Mini Mixer updater
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/env bash ${INSTALL_DIR}/scripts/pi/update.sh
EOF

cat > "/etc/systemd/system/${SERVICE_NAME}-update.timer" <<EOF
[Unit]
Description=Check for Ui24R Mini Mixer updates

[Timer]
OnBootSec=2min
OnUnitActiveSec=30min
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}.service"
systemctl enable --now "${SERVICE_NAME}-update.timer"

echo "Running initial update..."
set -a
source "${ENV_FILE}"
set +a
"${INSTALL_DIR}/scripts/pi/update.sh"

echo "Bootstrap complete."
echo "Edit ${ENV_FILE} any time and run: sudo systemctl restart ${SERVICE_NAME}.service"
