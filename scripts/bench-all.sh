#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
export ACCRETE_URL="${ACCRETE_URL:-http://localhost:8799}" ACCRETE_TOKEN="${ACCRETE_TOKEN:-local-dev}"
label="${1:-bench}"
rm -rf "bench/runs/$label"
for tool in $(node -e "for (const t of require('./bench/tools.json')) console.log(t.tool)"); do
  perl -e 'alarm 240; exec @ARGV' node scripts/bench.mjs "$tool" "$label" || echo "$tool [timeout or crash]"
done
node scripts/score.mjs "$label"
