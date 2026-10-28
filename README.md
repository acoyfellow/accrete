# accrete

Your coding agents build each npm tool once, then run it with no container.

Open source. **You deploy it to your own Cloudflare account.** It is not a hosted service.
Site: https://accrete.customer0.dev

When an agent needs a tool such as `json5`, `sass` or `terser`, accrete builds it once in a short-lived container. It then checks the bundle against the real tool's output and stores it by content hash. Every later call runs that bundle in a Worker isolate with no network and no secrets.

## Numbers

| | |
|---|---|
| Tools built (bench) | 10 of 11 real npm CLIs |
| Container time on a repeat run | 0.00 s per task |
| Repeat speed-up | about 49× (median) |
| Falsification tests | 4 of 4 refused |

These numbers come from sealed receipts in [`bench/`](bench) and [`receipts/`](receipts). The held-out tools were frozen before tuning. [`status.json`](status.json) lists what is proven, what is not proven yet, and what turned out to be wrong.

## Deploy to your account

You need Node 22, Docker, and a Cloudflare account on Workers Paid. The Worker uses Containers, R2, Durable Objects and Worker Loader.

```sh
git clone https://github.com/acoyfellow/accrete
cd accrete && npm install
# edit wrangler.jsonc: set account_id and routes to your own
npx wrangler r2 bucket create accrete-tools
npx wrangler secret put ACCRETE_TOKEN
npm run build && npx wrangler deploy
```

## Call it from your agent

```sh
curl -X POST "https://$HOST/task" \
  -H "Authorization: Bearer $ACCRETE_TOKEN" \
  -d '{
    "workspace": "agent-42",
    "seed": { "app.json5": "{ name: 1, }" },
    "steps": [{ "op": "tool", "name": "json5", "args": ["-s", "2", "app.json5"], "inputs": ["app.json5"] }]
  }'
```

The first call to a tool builds it and checks it. Every call after that runs the saved copy. To add a tool, send a recipe with `PUT /recipes`. See [`recipes/`](recipes) for examples.

## Limits

- Only npm tools that bundle to plain JavaScript. A tool that needs a native binary, or that generates code at run time, stays in the container. prettier is one example.
- Built tools get no network and no secrets.
- All write routes need the bearer token.

## Run it locally

```sh
npm install
npm run dev          # Worker on :8799, site on :5281
```

## Layout

| Path | What |
|---|---|
| `src/` | Worker: workspace, registry and builder Durable Objects, isolate runner |
| `builder/` | builder container: install, bundle, compare with native |
| `recipes/` | one recipe per tool |
| `bench/` | frozen train and held-out tool sets, ledger, score |
| `client/` | the site |
| `experiments/` | one folder per experiment, with negative results |
| `receipts/` | JSON receipts from gate and falsification runs |

## Routes

| Route | Access |
|---|---|
| `/`, `/llms.txt`, `/status.json` | public |
| `GET /api/status`, `GET /api/tools` | public, read only |
| `POST /api/reset`, `/api/run/*` | localhost only |
| `/tools`, `/task`, `/build`, `/recipes`, `/forget` | bearer token |

## License

MIT
