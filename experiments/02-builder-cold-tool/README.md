# 02: builder container and cold tools

**Claim.** A missing npm tool is built once in a short-lived container, checked against the native tool, and reused from the registry. A repeat run then uses 0 container-seconds.

**Setup.**

- `builder/`: a container that installs the package, bundles it with esbuild, and runs both the native tool and the bundle on a check case.
- `recipes/`: one recipe per tool. A recipe names the packages, the entry file and the check case.
- `scripts/gate.mjs`: clears `json5` and `tsc`, then runs the 6 tasks 3 times and the self-check.

**Run.** `bash proof/gate.sh`. It finishes in under 2 minutes.

**Result.** Gate passed. Receipts: `receipts/02-*.json`.

| Check | Observed |
|---|---|
| 1 | `tsc` built, native and built output match. The bad recipe was rejected. |
| 2 | Run 1 built `json5` cold: 5.1 container-seconds in the Worker log. |
| 3 | Runs 1, 2, 3: 6/6 each. Run 3: 0 container-seconds, 3 registry tools. |
| 4 | `tsc` from the registry: accrete's 8 `src/` files clean, 0 container-seconds. |

**Negative results.**

- GraphQL is not a meter for one build. The builder now stops after each build. A `json5` build with 7.3 s in the Worker log showed 0 uptime and 0 allocated vCPU in GraphQL for that minute. Another run showed 62 s of uptime against 6.4 s in the log. Check 2 uses the Worker log.
- TypeScript 7 is a native binary and cannot run in an isolate. The `tsc` tool uses TypeScript 5.9.3.

**Not checked.** The linter. `eslint` builds and passes, but the gate does not check it.
