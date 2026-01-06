#!/usr/bin/env bash
set -euo pipefail

TARGET_CONN="${1:-Rubberband Lan}"
REPO_DIR="${2:-$(pwd)}"
LOG_FILE="${3:-/tmp/switch-wifi-pull.log}"

ACTIVE_CONN="$(nmcli -t -f NAME,TYPE,DEVICE con show --active | awk -F: '$2=="wifi"{print $1; exit}')"
if [[ -z "${ACTIVE_CONN}" ]]; then
  echo "No active Wi-Fi connection found." | tee -a "$LOG_FILE"
  exit 1
fi

if [[ "$ACTIVE_CONN" == "$TARGET_CONN" ]]; then
  echo "Already on ${TARGET_CONN}, running git pull in ${REPO_DIR}." | tee -a "$LOG_FILE"
else
  echo "Switching Wi-Fi: ${ACTIVE_CONN} -> ${TARGET_CONN}" | tee -a "$LOG_FILE"
  nmcli con up "$TARGET_CONN" | tee -a "$LOG_FILE"
  sleep 5
fi

echo "Running git pull in ${REPO_DIR}" | tee -a "$LOG_FILE"
git -C "$REPO_DIR" pull | tee -a "$LOG_FILE"

if [[ "$ACTIVE_CONN" != "$TARGET_CONN" ]]; then
  echo "Switching back to ${ACTIVE_CONN}" | tee -a "$LOG_FILE"
  nmcli con up "$ACTIVE_CONN" | tee -a "$LOG_FILE"
fi

echo "Done." | tee -a "$LOG_FILE"
