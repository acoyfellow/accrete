# accrete

Agents on Durable Objects build the tools they need once, then run them with no container.

A missing npm tool is built once in a short-lived container, checked against the native tool, and stored by content hash. After that it runs in a Worker isolate. A repeat run uses 0 container-seconds.

**State:** notebook, iteration 2. Evidence: [`status.json`](status.json), [`receipts/`](receipts), [`experiments/`](experiments).

## Run it locally

Needs Node 22 and Docker. Nothing is deployed.

```sh
npm install
npm run dev          # Worker on :8799, site on :5281
npm run gate:local   # slice 2 gate against local dev
```

Open http://localhost:5281 and use the demo: reset the registry, run the json5 task twice, then check accrete with accrete (tsc from the registry on `src/`).

## Layout

| Path | What |
|---|---|
| `src/` | Worker: workspace, registry and builder Durable Objects, isolate runner, demo API |
| `builder/` | builder container: install, bundle, compare with native |
| `recipes/` | one recipe per tool |
| `client/` | site: foldkit, Effect, Tailwind |
| `experiments/` | one folder per experiment, with result and negative results |
| `receipts/` | JSON receipts from gate runs |
| `proof/gate.sh` | the gate |

## Routes

| Route | Access |
|---|---|
| `/`, `/llms.txt`, `/status.json` | public |
| `GET /api/status`, `GET /api/tools` | public, read only |
| `POST /api/reset`, `/api/run/*` | localhost only |
| `/tools`, `/task`, `/build`, `/recipes`, `/forget` | bearer token |
