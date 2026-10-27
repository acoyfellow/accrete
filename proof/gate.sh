#!/usr/bin/env bash
set -euo pipefail
export PATH=/Users/jcoeyman/.nvm/versions/node/v22.22.2/bin:$PATH
cd "$(dirname "$0")/.."
if [ -z "${ACCRETE_URL:-}" ] && [ -f proof/url ]; then ACCRETE_URL=$(cat proof/url); fi
if [ -z "${ACCRETE_TOKEN:-}" ] && [ -f .secrets/token ]; then ACCRETE_TOKEN=$(cat .secrets/token); fi
export ACCRETE_URL ACCRETE_TOKEN
bounded() { perl -e 'alarm shift; exec @ARGV or die' "$@"; }
bounded 30 npx tsc -p .
bounded 10 node scripts/make-recipes.mjs
bounded 100 node scripts/gate.mjs
