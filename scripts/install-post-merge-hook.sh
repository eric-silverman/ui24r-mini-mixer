#!/usr/bin/env sh
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOOK_PATH="$REPO_ROOT/.git/hooks/post-merge"

cat <<'HOOK' > "$HOOK_PATH"
#!/usr/bin/env sh
set -e

HOSTNAME_FULL="$(hostname -f 2>/dev/null || hostname)"
HOSTNAME_SHORT="$(hostname)"

if [ "$HOSTNAME_FULL" = "mix.local" ] || [ "$HOSTNAME_SHORT" = "mix.local" ] || [ "$HOSTNAME_SHORT" = "mix" ]; then
  npm run prod:setup
fi
HOOK

chmod +x "$HOOK_PATH"

echo "Installed post-merge hook to $HOOK_PATH"
