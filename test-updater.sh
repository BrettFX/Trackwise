#!/usr/bin/env bash
# Simulate the update check flow against the local test server.
#
# Usage:
#   ./test-updater.sh                  — runs all three scenarios in sequence
#   ./test-updater.sh newer            — fake version higher than current (update available)
#   ./test-updater.sh same             — fake version equal to current (up to date)
#   ./test-updater.sh older            — fake version lower than current (up to date)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8765
ENDPOINT="http://localhost:${PORT}/latest.json"

# Read current app version from tauri.conf.json
CURRENT_VERSION=$(node -e "
  const fs = require('fs');
  const conf = JSON.parse(fs.readFileSync('${SCRIPT_DIR}/src-tauri/tauri.conf.json', 'utf8'));
  process.stdout.write(conf.version);
")

# Derive test versions relative to current (assumes semver MAJOR.MINOR.PATCH)
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"
VERSION_NEWER="${MAJOR}.${MINOR}.$((PATCH + 1))"
VERSION_SAME="${CURRENT_VERSION}"
VERSION_OLDER="${MAJOR}.${MINOR}.$((PATCH > 0 ? PATCH - 1 : 0))"

# ── helpers ──────────────────────────────────────────────────────────────────

start_server() {
  local fake_version="$1"
  node "${SCRIPT_DIR}/test-updater.js" --version "$fake_version" --port "$PORT" &
  SERVER_PID=$!
  # Wait until the server is accepting connections
  local attempts=0
  until curl -sf "$ENDPOINT" > /dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [[ $attempts -ge 20 ]]; then
      echo "  ERROR: server did not start in time" >&2
      kill "$SERVER_PID" 2>/dev/null || true
      return 1
    fi
    sleep 0.1
  done
}

stop_server() {
  kill "$SERVER_PID" 2>/dev/null || true
  wait "$SERVER_PID" 2>/dev/null || true
}

run_scenario() {
  local label="$1"
  local fake_version="$2"
  local expected="$3"   # "update_available" or "up_to_date"

  echo ""
  echo "┌─────────────────────────────────────────────────────"
  echo "│ Scenario : ${label}"
  echo "│ App ver  : ${CURRENT_VERSION}"
  echo "│ Remote   : ${fake_version}"
  echo "│ Expect   : ${expected//_/ }"
  echo "└─────────────────────────────────────────────────────"

  start_server "$fake_version"

  # Fetch latest.json exactly as the Tauri updater would
  local response
  response=$(curl -sf "$ENDPOINT")
  local remote_version
  remote_version=$(echo "$response" | node -e "
    const chunks = [];
    process.stdin.on('data', c => chunks.push(c));
    process.stdin.on('end', () => {
      const j = JSON.parse(chunks.join(''));
      process.stdout.write(j.version);
    });
  ")

  stop_server

  # Determine result using the same semver comparison logic as the plugin
  local result
  if node -e "
    const [av, bv] = ['${CURRENT_VERSION}', '${remote_version}'].map(v => v.split('.').map(Number));
    for (let i = 0; i < 3; i++) {
      if ((bv[i]||0) > (av[i]||0)) { process.exit(0); }
      if ((bv[i]||0) < (av[i]||0)) { process.exit(1); }
    }
    process.exit(1);
  " 2>/dev/null; then
    result="update_available"
  else
    result="up_to_date"
  fi

  if [[ "$result" == "$expected" ]]; then
    echo "  PASS — got '${result//_/ }' as expected"
    echo "  Response payload:"
    echo "$response" | sed 's/^/    /'
    return 0
  else
    echo "  FAIL — expected '${expected//_/ }' but got '${result//_/ }'"
    return 1
  fi
}

# ── main ─────────────────────────────────────────────────────────────────────

SCENARIO="${1:-all}"
PASS=0
FAIL=0

run_one() {
  if run_scenario "$@"; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
  fi
}

case "$SCENARIO" in
  newer) run_one "Newer version available"     "$VERSION_NEWER" "update_available" ;;
  same)  run_one "Same version (up to date)"   "$VERSION_SAME"  "up_to_date"       ;;
  older) run_one "Older version (up to date)"  "$VERSION_OLDER" "up_to_date"       ;;
  all)
    run_one "Newer version available"     "$VERSION_NEWER" "update_available"
    run_one "Same version (up to date)"   "$VERSION_SAME"  "up_to_date"
    run_one "Older version (up to date)"  "$VERSION_OLDER" "up_to_date"
    ;;
  *)
    echo "Unknown scenario '${SCENARIO}'. Use: newer | same | older | all"
    exit 1
    ;;
esac

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Results: ${PASS} passed, ${FAIL} failed"
echo "═══════════════════════════════════════════════════════"

[[ $FAIL -eq 0 ]]
