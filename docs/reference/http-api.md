---
title: HTTP API
section: reference
order: 1
description: Every accrete route, request body, and response.
---

# HTTP API

All routes below need `Authorization: Bearer <ACCRETE_TOKEN>`. Bodies are JSON.

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/task` | Run steps in a workspace |
| `PUT` | `/recipes` | Store a recipe |
| `POST` | `/build` | Build and check a recipe now |
| `GET` | `/tools` | List registered tools |
| `POST` | `/tools` | Register a prebuilt bundle |
| `POST` | `/forget` | Remove tools from the registry |

Public, read-only: `GET /api/status`, `GET /api/tools`, `/llms.txt`, `/status.json`.

## POST /task

```json
{
  "workspace": "agent-42",
  "seed": { "a.yaml": "name: x\n" },
  "steps": [
    { "op": "tool", "name": "lift-js-yaml-4-1-0", "args": ["a.yaml"], "inputs": ["a.yaml"], "stdoutTo": "out.json" }
  ]
}
```

`workspace` names a Durable Object. `seed` replaces its files. Steps run in order and stop at the first failure.

| Step | Fields | Effect |
|---|---|---|
| `tool` | `name`, `args`, `inputs`, `stdoutTo?` | Runs a tool on the listed input files. Output files are written back; stdout goes to `stdoutTo` if set. |
| `read` | `path` | Adds the file to `reads` |
| `write` | `path`, `content` | Writes a file |
| `edit` | `path`, `find`, `replace` | Replaces the first match; fails if not found |

Response:

```json
{
  "ok": true,
  "files": { "a.yaml": "...", "out.json": "..." },
  "reads": [],
  "logs": [
    { "op": "tool", "placement": "built-tool", "tool": "lift-js-yaml-4-1-0@4.1.0", "hash": "81424f…", "ms": 41, "containerSeconds": 0, "ok": true }
  ]
}
```

`placement` is `built-tool` for a registry hit, `container` when the call built the tool, and `isolate` for file steps.

## PUT /recipes

Body: a [recipe](/docs/reference/recipe/). Stores it so a later `tool` step with that `name` can build on a miss. Returns `{ "ok": true, "name": "..." }`. Returns `400` for a malformed recipe.

## POST /build

Body: a recipe. Builds now, checks against the real CLI, and registers on a match. Returns a build receipt. Returns `500` if the output differs; the tool is not listed.

## GET /tools

Returns `[{ name, version, hash, kind, registeredAt, check }]`.

## POST /forget

Body: `{ "names": ["lift-sass-1-80-6"] }`. Removes those tools. The next call rebuilds.
