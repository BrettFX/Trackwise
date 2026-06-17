#!/usr/bin/env bash
# Usage:
#   ./update-version.sh          — keeps current version, updates build date
#   ./update-version.sh 1.2.3   — sets version to 1.2.3 and updates build date

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

version="${1:-}"

if [ -z "$version" ]; then
  node update-version.js
else
  node update-version.js "$version"
fi
