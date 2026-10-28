---
title: Which workflows benefit
section: explanation
order: 1
description: Measured numbers for six real agent workflows — laptop npx versus accrete first call versus accrete repeat.
---

# Which workflows benefit

accrete helps when an agent runs **the same pure CLI many times**. The first call pays for a build. Every call after that is a function call.

## Measured

Each workflow ran the real CLI with `npx` on a laptop (cache warm), then through the [Pi extension client](/docs/reference/pi-extension/) against accrete: once cold, then repeated. Every accrete output was compared with the `npx` output.

{{WORKFLOW_TABLE}}

## How to read this

- **Repeat vs laptop.** A warm `npx` call still starts Node and loads the package: about half a second. A lifted tool is already loaded in an isolate.
- **First call.** The first call to a tool and version is slower than `npx`, because it builds the tool and checks it against the real CLI. It happens once per tool version, for every agent that shares your Worker.
- **Container time on repeat.** It is 0.00 s on every row. No repeat call started a container.
- **Where it ran.** These numbers are from accrete on local `wrangler dev`. A deployed Worker adds your network round trip and removes laptop CPU from the path.

## Good fits

- Compile on every save: `sass`, `lessc`, `tsc` type checks.
- Format before every commit: `sql-formatter`, `js-yaml` normalization.
- Minify or transform build output: `terser`, `marked`, `markdown-it`, `mustache`.
- Many agents, same tools: a team or a fleet shares one registry, so only the first agent anywhere pays the build.
- Agents that run in the cloud with no local Node at all.

## Poor fits

- One-off commands. The first call costs more than `npx`.
- Tools that need the network, native binaries, or code generation at run time. `prettier` is an example: it loads its CLI with `new Function`, so accrete rejects it and it stays a container tool.
- Tools that read files you do not send. accrete only sees `inputs`.
