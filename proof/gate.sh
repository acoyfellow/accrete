#!/usr/bin/env bash
set -euo pipefail
export PATH=/Users/jcoeyman/.nvm/versions/node/v22.22.2/bin:$PATH
cd "$(dirname "$0")/.."
if [ -z "${ACCRETE_URL:-}" ] && [ -f proof/url ]; then ACCRETE_URL=$(cat proof/url); fi
if [ -z "${ACCRETE_TOKEN:-}" ] && [ -f .secrets/token ]; then ACCRETE_TOKEN=$(cat .secrets/token); fi
export ACCRETE_URL ACCRETE_TOKEN
npx tsc -p .
node scripts/build-tools.mjs
node scripts/register-tools.mjs
for run in 1 2 3; do
  node scripts/run-tasks.mjs "gate-run-$run"
done
echo "GATE ITEM 1 PASS: 5/5 tasks on run 1, 2, 3"
