#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
trap 'kill 0' EXIT
npm run dev:worker &
npm run dev:site &
wait
