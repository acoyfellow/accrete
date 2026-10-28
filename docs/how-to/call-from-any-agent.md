---
title: Call accrete from any agent
section: how-to
order: 3
description: Run a lifted tool from any agent or language with one HTTP request.
---

# Call accrete from any agent

accrete is plain HTTP. Any agent that can make a request can use it.

## Shell

```sh
curl -X POST "$ACCRETE_URL/task" \
  -H "Authorization: Bearer $ACCRETE_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "workspace": "agent-42",
    "seed": { "a.yaml": "name: accrete\n" },
    "steps": [{ "op": "tool", "name": "lift-js-yaml-4-1-0", "args": ["a.yaml"], "inputs": ["a.yaml"], "stdoutTo": "out.json" }]
  }'
```

The response has `files["out.json"]` and one log entry per step with `placement` and `containerSeconds`.

## Node, without writing a recipe

`extensions/pi/client.mjs` has no dependencies. Copy it or import it:

```js
import { lift } from './client.mjs';

const result = await lift(
  { url: process.env.ACCRETE_URL, token: process.env.ACCRETE_TOKEN },
  { pkg: 'terser', version: '5.36.0', args: ['app.js', '-c', '-m'], inputs: ['app.js'] },
);
console.log(result.placement, result.ms, result.stdout.length);
```

`lift` writes the recipe, runs the task, writes changed files back, and returns a receipt.

## Python

```python
import json, os, urllib.request

body = {
    "workspace": "agent-42",
    "seed": {"q.sql": "select a,b from t where x=1"},
    "steps": [{"op": "tool", "name": "lift-sql-formatter-15-4-5", "args": ["q.sql"], "inputs": ["q.sql"], "stdoutTo": "out.sql"}],
}
req = urllib.request.Request(
    os.environ["ACCRETE_URL"] + "/task",
    data=json.dumps(body).encode(),
    headers={"authorization": "Bearer " + os.environ["ACCRETE_TOKEN"], "content-type": "application/json"},
)
print(json.load(urllib.request.urlopen(req))["files"]["out.sql"])
```

The tool must be registered first. Use `lift` once, or send a [recipe](/docs/how-to/add-a-tool/).
