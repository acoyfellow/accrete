#!/usr/bin/env bash
set -uo pipefail
export PATH=/Users/jcoeyman/.nvm/versions/node/v22.22.2/bin:$PATH
cd "$(dirname "$0")/.."
label="${1:-bench}"
rm -rf "bench/runs/$label"
for tool in $(node -e "for (const t of require('./bench/tools.json')) console.log(t.tool)"); do
  perl -e 'alarm 240; exec @ARGV' node scripts/bench.mjs "$tool" "$label" || echo "$tool [timeout or crash]"
done
node scripts/score.mjs "$label"
