#!/usr/bin/env bash
set -euo pipefail

GITHUB_REPO=${GITHUB_REPO:-"your-org/ui24r-mini-mixer"}
INSTALL_DIR=${INSTALL_DIR:-"/opt/ui24r-mini-mixer"}
SERVICE_NAME=${SERVICE_NAME:-"ui24r-mini-mixer"}
ASSET_PREFIX=${ASSET_PREFIX:-"ui24r-mini-mixer"}
FORCE_UPDATE="0"
LOCAL_FILE=""
DIRECT_URL=""

usage() {
  cat <<'EOF'
Usage: update.sh [--force] [--file <path>] [--url <url>]

Options:
  --file <path>  Install from a local tar.gz file (offline mode).
  --url <url>    Download and install from a direct URL.
  --force        Reinstall even if already on latest release tag.
  -h, --help     Show this help.

Examples:
  # Update from GitHub (requires internet)
  sudo ./update.sh

  # Install from local file (offline)
  sudo ./update.sh --file /path/to/ui24r-mini-mixer-v1.0.0.tar.gz

  # Install from direct URL
  sudo ./update.sh --url https://github.com/.../ui24r-mini-mixer-v1.0.0.tar.gz
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE_UPDATE="1"
      shift
      ;;
    --file)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --file requires a path argument" >&2
        exit 1
      fi
      LOCAL_FILE="$2"
      shift 2
      ;;
    --url)
      if [[ -z "${2:-}" ]]; then
        echo "Error: --url requires a URL argument" >&2
        exit 1
      fi
      DIRECT_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: ${1}" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if ! command -v tar >/dev/null; then
  echo "tar is required." >&2
  exit 1
fi

state_dir="${INSTALL_DIR}/.update"
current_tag_file="${state_dir}/release-tag"
mkdir -p "$state_dir"

tmp_dir=$(mktemp -d)
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

asset_path="${tmp_dir}/release.tar.gz"

if [[ -n "$LOCAL_FILE" ]]; then
  # Offline mode: use local file
  if [[ ! -f "$LOCAL_FILE" ]]; then
    echo "File not found: ${LOCAL_FILE}" >&2
    exit 1
  fi

  # Extract version from filename (e.g., ui24r-mini-mixer-v1.0.0.tar.gz -> v1.0.0)
  basename_file=$(basename "$LOCAL_FILE")
  tag_name="${basename_file%.tar.gz}"
  tag_name="${tag_name#ui24r-mini-mixer-}"

  if [[ -f "$current_tag_file" && "$FORCE_UPDATE" != "1" ]]; then
    current_tag=$(cat "$current_tag_file")
    if [[ "$current_tag" == "$tag_name" ]]; then
      echo "Already on ${tag_name}. Use --force to reinstall."
      exit 0
    fi
  fi

  cp "$LOCAL_FILE" "$asset_path"
  echo "Installing from local file: ${LOCAL_FILE}"
elif [[ -n "$DIRECT_URL" ]]; then
  # Direct URL mode: download from provided URL
  if ! command -v curl >/dev/null; then
    echo "curl is required to download from URL." >&2
    exit 1
  fi

  # Extract version from URL filename (e.g., .../ui24r-mini-mixer-v1.0.0.tar.gz -> v1.0.0)
  url_basename=$(basename "$DIRECT_URL")
  tag_name="${url_basename%.tar.gz}"
  tag_name="${tag_name#ui24r-mini-mixer-}"

  if [[ -f "$current_tag_file" && "$FORCE_UPDATE" != "1" ]]; then
    current_tag=$(cat "$current_tag_file")
    if [[ "$current_tag" == "$tag_name" ]]; then
      echo "Already on ${tag_name}. Use --force to reinstall."
      exit 0
    fi
  fi

  echo "Downloading from ${DIRECT_URL}..."
  curl -fsSL "$DIRECT_URL" -o "$asset_path"
  echo "Downloaded ${tag_name}."
else
  # Online mode: fetch from GitHub
  if ! command -v curl >/dev/null; then
    echo "curl is required for online updates." >&2
    exit 1
  fi

  if ! command -v python3 >/dev/null; then
    echo "python3 is required for online updates." >&2
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
        asset_url = asset.get("url") or ""
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

  if [[ -f "$current_tag_file" && "$FORCE_UPDATE" != "1" ]]; then
    current_tag=$(cat "$current_tag_file")
    if [[ "$current_tag" == "$tag_name" ]]; then
      echo "Already on ${tag_name}."
      exit 0
    fi
  fi

  download_args=("${curl_args[@]}" -H "Accept: application/octet-stream")
  curl "${download_args[@]}" "$asset_url" -o "$asset_path"
  echo "Downloaded ${tag_name} from GitHub."
fi

tar -xzf "$asset_path" -C "$tmp_dir"

# Handle both nested (ui24r-mini-mixer/) and flat archive structures
if [[ -d "${tmp_dir}/ui24r-mini-mixer" ]]; then
  extract_dir="${tmp_dir}/ui24r-mini-mixer"
else
  extract_dir="$tmp_dir"
fi

if [[ ! -d "${extract_dir}/server/dist" || ! -d "${extract_dir}/client/dist" ]]; then
  echo "Release archive missing expected dist folders." >&2
  exit 1
fi

mkdir -p "${INSTALL_DIR}/server" "${INSTALL_DIR}/client"

rm -rf "${INSTALL_DIR}/server/dist"
rm -rf "${INSTALL_DIR}/client/dist"

cp -a "${extract_dir}/server/dist" "${INSTALL_DIR}/server/"
cp -a "${extract_dir}/client/dist" "${INSTALL_DIR}/client/"

if [[ -f "${extract_dir}/server/package.json" ]]; then
  cp -a "${extract_dir}/server/package.json" "${INSTALL_DIR}/server/package.json"
fi

if [[ -f "${extract_dir}/server/package-lock.json" ]]; then
  cp -a "${extract_dir}/server/package-lock.json" "${INSTALL_DIR}/server/package-lock.json"
fi

if [[ -d "${extract_dir}/scripts/pi" ]]; then
  mkdir -p "${INSTALL_DIR}/scripts"
  rm -rf "${INSTALL_DIR}/scripts/pi"
  cp -a "${extract_dir}/scripts/pi" "${INSTALL_DIR}/scripts/"
fi

# Check if node_modules is bundled in the archive (offline package)
if [[ -d "${extract_dir}/server/node_modules" ]]; then
  echo "Installing bundled dependencies..."
  rm -rf "${INSTALL_DIR}/server/node_modules"
  cp -a "${extract_dir}/server/node_modules" "${INSTALL_DIR}/server/"
else
  # No bundled deps, need to install via npm
  if command -v npm >/dev/null; then
    echo "Installing dependencies via npm..."
    (cd "${INSTALL_DIR}/server" && npm ci --omit=dev)
  else
    echo "npm is required to install server dependencies." >&2
    exit 1
  fi
fi

echo "$tag_name" > "$current_tag_file"

if command -v systemctl >/dev/null; then
  systemctl restart "$SERVICE_NAME"
fi

echo "Updated to ${tag_name}."
