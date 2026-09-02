#!/usr/bin/env bash
# Launches Trackwise as a real desktop app (Tauri dev build) so you can test
# desktop-only features like the local Ollama AI rewrite — `npm run dev` alone
# only starts the browser preview, where those features stay hidden.
#
# Usage:
#   ./run-desktop.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

OLLAMA_URL="http://localhost:11434/api/tags"

echo "Checking for a local Ollama server..."
if curl -sf -m 3 "$OLLAMA_URL" > /dev/null 2>&1; then
  MODELS=$(curl -sf -m 3 "$OLLAMA_URL" | node -e "
    let data = '';
    process.stdin.on('data', (c) => data += c);
    process.stdin.on('end', () => {
      const models = (JSON.parse(data).models || []).map((m) => m.name);
      console.log(models.length ? models.join(', ') : '(none pulled yet)');
    });
  " 2>/dev/null || echo "(unable to list models)")
  echo "  Found Ollama — installed models: ${MODELS}"
  echo "  The \"AI rewrite\" button will appear next to \"Copy summary\" in task lineage."
else
  echo "  No Ollama server detected at ${OLLAMA_URL}."
  echo "  The app will still run, but the \"AI rewrite\" button won't appear until Ollama is running."
  echo "  Start it with: ollama serve   (and \"ollama pull qwen2.5:1.5b\" if you haven't already)"
fi

echo ""
echo "Launching Trackwise desktop app (npm run tauri:dev)..."
npm run tauri:dev
