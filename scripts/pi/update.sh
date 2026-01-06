#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO=${GITHUB_REPO:-"your-org/ui24r-mini-mixer"}
INSTALL_DIR=${INSTALL_DIR:-"/opt/ui24r-mini-mixer"}
SERVICE_NAME=${SERVICE_NAME:-"ui24r-mini-mixer"}
ASSET_PREFIX=${ASSET_PREFIX:-"ui24r-mini-mixer"}
FORCE_UPDATE="0"

usage() {
  cat <<'EOF'
Usage: update.sh [--force]

Options:
  --force   Reinstall even if already on latest release tag.
  -h, --help  Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE_UPDATE="1"
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v curl >/dev/null; then
  echo "curl is required." >&2
  exit 1
fi

if ! command -v python3 >/dev/null; then
  echo "python3 is required." >&2
  exit 1
fi

if ! command -v tar >/dev/null; then
  echo "tar is required." >&2
  exit 1
fi

api_url="https://api.github.com/repos/${GITHUB_REPO}/releases/latest"
curl_args=(-fsSL)
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  curl_args+=(-H "Authorization: Bearer ${GITHUB_TOKEN}")
fi
release_json=$(curl "${curl_args[@]}" "$api_url")

mapfile -t release_fields < <(
  RELEASE_JSON="$release_json" python3 - <<'PY'
import json
import os
import sys

asset_prefix = os.environ.get("ASSET_PREFIX", "ui24r-mini-mixer")
release_json = os.environ.get("RELEASE_JSON", "")

try:
    data = json.loads(release_json)
except json.JSONDecodeError:
    print(" ")
    sys.exit(0)

tag = data.get("tag_name") or ""
assets = data.get("assets") or []
asset_url = ""
for asset in assets:
    name = asset.get("name") or ""
    if name.startswith(asset_prefix) and name.endswith(".tar.gz"):
        asset_url = asset.get("browser_download_url") or ""
        break

print(tag)
print(asset_url)
PY
)

tag_name=${release_fields[0]:-}
asset_url=${release_fields[1]:-}

if [[ -z "$tag_name" || -z "$asset_url" ]]; then
  echo "Unable to resolve latest release asset for ${GITHUB_REPO}." >&2
  exit 1
fi

state_dir="${INSTALL_DIR}/.update"
current_tag_file="${state_dir}/release-tag"

mkdir -p "$state_dir"

if [[ -f "$current_tag_file" && "$FORCE_UPDATE" != "1" ]]; then
  current_tag=$(cat "$current_tag_file")
  if [[ "$current_tag" == "$tag_name" ]]; then
    echo "Already on ${tag_name}."
    exit 0
  fi
fi

tmp_dir=$(mktemp -d)
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

asset_path="${tmp_dir}/release.tar.gz"

curl -fsSL "$asset_url" -o "$asset_path"

tar -xzf "$asset_path" -C "$tmp_dir"

if [[ ! -d "${tmp_dir}/server/dist" || ! -d "${tmp_dir}/client/dist" ]]; then
  echo "Release archive missing expected dist folders." >&2
  exit 1
fi

mkdir -p "${INSTALL_DIR}/server" "${INSTALL_DIR}/client"

rm -rf "${INSTALL_DIR}/server/dist"
rm -rf "${INSTALL_DIR}/client/dist"

cp -a "${tmp_dir}/server/dist" "${INSTALL_DIR}/server/"
cp -a "${tmp_dir}/client/dist" "${INSTALL_DIR}/client/"

if [[ -f "${tmp_dir}/server/package.json" ]]; then
  cp -a "${tmp_dir}/server/package.json" "${INSTALL_DIR}/server/package.json"
fi

if [[ -f "${tmp_dir}/server/package-lock.json" ]]; then
  cp -a "${tmp_dir}/server/package-lock.json" "${INSTALL_DIR}/server/package-lock.json"
fi

if [[ -d "${tmp_dir}/scripts/pi" ]]; then
  mkdir -p "${INSTALL_DIR}/scripts"
  rm -rf "${INSTALL_DIR}/scripts/pi"
  cp -a "${tmp_dir}/scripts/pi" "${INSTALL_DIR}/scripts/"
fi

if command -v npm >/dev/null; then
  (cd "${INSTALL_DIR}/server" && npm ci --omit=dev)
else
  echo "npm is required to install server dependencies." >&2
  exit 1
fi

echo "$tag_name" > "$current_tag_file"

if command -v systemctl >/dev/null; then
  systemctl restart "$SERVICE_NAME"
fi

echo "Updated to ${tag_name}."
