---
title: Use accrete from Pi
section: how-to
order: 1
description: Install the pi-accrete extension so your Pi agent lifts repeated npm CLI work from your laptop to your own accrete Worker.
---

# Use accrete from Pi

This guide adds the `accrete_run` tool to [Pi](https://pi.dev). After that, when your agent needs `sass`, `terser`, `sql-formatter` or another pure npm CLI, it can run the tool on your accrete Worker instead of with `npx` on your laptop.

You need a deployed accrete Worker. If you do not have one, do the [tutorial](/docs/tutorials/first-deploy/) first.

## Install the extension

```sh
pi install git:github.com/acoyfellow/accrete
```

This installs the package in `extensions/pi`. To try it for one session only:

```sh
pi -e git:github.com/acoyfellow/accrete
```

## Point it at your Worker

```sh
export ACCRETE_URL=https://accrete.example.com
export ACCRETE_TOKEN=<your token>
```

Put these in your shell profile. The extension reads them when it runs a tool.

## Check the connection

Start Pi and run:

```
/accrete
```

Pi shows your Worker URL, the number of tools in your registry, and the container-seconds used in this session.

## Let the agent use it

Ask for work that repeats a CLI. For example:

> Compile every `.scss` file in `styles/` to CSS with sass, then minify `dist/app.js` with terser.

The agent calls `accrete_run` with the package, the arguments, and the input files. The footer status shows how many calls ran with no boot:

```
accrete 11/12 no-boot · 5.41 container-s
```

The first call to each tool and version builds it once. The rest run in tens of milliseconds.

## Find the receipts

Each call appends one line to `~/.accrete/receipts.jsonl`: tool and version, tool hash, input and output hashes, placement, container-seconds, and time. Use it to see what your agents lifted and what it cost.

## When the agent should not use it

The tool description tells the model to use `accrete_run` only for deterministic file transforms. Tools that need the network, native binaries, or files outside the listed inputs fail on accrete by design. See [Limits](/docs/explanation/limits/).
