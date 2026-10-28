---
title: Deploy accrete and lift your first tool
section: tutorials
order: 1
description: From git clone to a repeat tool call with 0 container-seconds, on your own Cloudflare account.
---

# Deploy accrete and lift your first tool

In this tutorial you deploy accrete to your Cloudflare account. Then you run `js-yaml` twice: once cold, once warm. At the end you will see the second call finish in tens of milliseconds with 0 container-seconds.

## What you need

- A Cloudflare account on the Workers Paid plan. accrete uses Containers, R2, Durable Objects, and Worker Loader.
- Node 22 and Docker running on your machine. Docker builds the builder image once during deploy.
- About fifteen minutes.

## 1. Clone and install

```sh
git clone https://github.com/acoyfellow/accrete
cd accrete
npm install
npx wrangler login
```

## 2. Point it at your account

Open `wrangler.jsonc`. Set `account_id` to your account. Set `routes` to a hostname on a zone you own, or remove `routes` and set `"workers_dev": true` to use `accrete.<you>.workers.dev`.

```jsonc
"account_id": "<your account id>",
"routes": [{ "pattern": "accrete.example.com", "custom_domain": true }],
```

## 3. Create storage and a token

```sh
npx wrangler r2 bucket create accrete-tools
openssl rand -hex 32 | tee .accrete-token | npx wrangler secret put ACCRETE_TOKEN
```

Keep `.accrete-token`. Every write call needs it.

## 4. Deploy

```sh
npm run deploy
```

The first deploy pushes the builder container image, so it takes a few minutes. When it finishes, open your hostname. You see the accrete home page.

## 5. Call a tool twice

```sh
export ACCRETE_URL=https://accrete.example.com
export ACCRETE_TOKEN=$(cat .accrete-token)
printf 'name: accrete\nlist: [1, 2]\n' > a.yaml
node extensions/pi/cli.mjs js-yaml@4.1.0 a.yaml --input a.yaml
node extensions/pi/cli.mjs js-yaml@4.1.0 a.yaml --input a.yaml
```

The first call prints `container` and a few seconds of container time. accrete installed `js-yaml`, bundled it, and checked it against the real CLI.

The second call prints `built-tool`, about 70 ms, and `0.00` container-seconds. It ran the saved copy in an isolate. Every later call with this tool and version does the same.

## What you did

You deployed a private tool registry to your own account. You lifted one npm CLI from "boot a computer" to "run a function". Next:

- [Use accrete from Pi](/docs/how-to/use-with-pi/) so your agent does this for you.
- [Which workflows benefit](/docs/explanation/workflows/) to choose what to lift first.
