
# Pi extension

Package: `extensions/pi` in the repository. Install with `pi install git:github.com/acoyfellow/accrete`.

## Environment

| Variable | Meaning |
|---|---|
| `ACCRETE_URL` | Your Worker, e.g. `https://accrete.example.com` |
| `ACCRETE_TOKEN` | The bearer token you set with `wrangler secret put` |

## Tool: `accrete_run`

| Parameter | Type | Meaning |
|---|---|---|
| `package` | string | npm package that ships the CLI |
| `args` | string[] | CLI arguments, as for `npx` |
| `inputs` | string[]? | Files to send, relative to the working directory |
| `version` | string? | Exact version. Default: npm `latest`, resolved at call time. |
| `bin` | string? | Binary name if it differs from the package, e.g. `lessc` for `less` |

The tool returns stdout (truncated at 40,000 characters) and a header line with placement, time, and container-seconds. Changed files are written back into the working directory. Paths outside it are ignored.

`details` carries the full receipt.

## Command: `/accrete`

Shows the Worker URL, the number of registered tools, and this session's totals.

## Status

The footer shows `accrete <no-boot>/<calls> no-boot · <n> container-s` after the first call.

## Receipts

Each call appends one JSON line to `~/.accrete/receipts.jsonl`:

```json
{"kind":"accrete-lift","at":"…","tool":"terser@5.36.0","toolHash":"81424f…","args":["app.js","-c","-m"],"inputHash":"…","outputHash":"…","placement":"built-tool","containerSeconds":0,"ms":87,"ok":true}
```

## CLI

The same client works without Pi:

```sh
node extensions/pi/cli.mjs <package>[@version] [args...] [--input <file>]... [--bin <name>] [--no-write]
```

stdout is the tool's stdout. A one-line summary goes to stderr. The exit code is 1 if the tool failed.
