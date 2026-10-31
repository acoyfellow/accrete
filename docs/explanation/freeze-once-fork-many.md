# Freeze once, fork many

Status: this work moved to a separate package, `amber-accrete`, so that amber and accrete stay independent and each keeps its own evals. accrete keeps only the snapshot store (`POST /snapshots`, `GET /snapshots/:key`). The receipts below now live in `amber-accrete/bench/` as `fork-simulated.json` and `fork-real.json`.

## Result

| Measure | Value |
|---|---|
| Plan written by | @cf/moonshotai/kimi-k2.6 in 3179 ms, 313 characters |
| Frozen snapshot | 2958 bytes, kept by content key |
| Fresh run, setup included | 3541 ms |
| Fork from the kept snapshot, median of 10 | 963 ms |
| Setup calls across all forks | 0 |
| Container-seconds across all forks | 0 |
| Branches at the decision | approve, request-changes, needs-tests |

Refused: a fork with a different engine hash, a fork whose tool hash changed after the freeze, and a fork with a write tool that is not allowed.

The first run used simulated setup: two 1.5 s waits with fixed data.

## Result with real setup

Receipt: `amber-accrete/bench/fork-real.json`. Setup is real work. The model reads the package contributor rules (`AGENTS.md`, 9 KB) and returns review rules. Then tsc runs through accrete on the cloudflare-agent `packages/analytics` slice.

| Measure | Value |
|---|---|
| Fresh run, setup included | 18340 ms, 2276 model tokens |
| Fork from the kept snapshot, median of 10 | 642 ms, 0 model tokens |
| Snapshot | 3353 bytes |

Each fork skips the 2276 setup tokens and about 18 s of setup.

What is not proven:

- tsc used 0 container-seconds in setup because accrete already kept the tsc tool. A first-time tool build would add container time to the fresh run, not to the forks.
- A frozen plan can hold facts that go stale, for example a file count. There is no rule yet for how old a snapshot can be.
- The engine and tool checks run in the example harness, not in a shared library.

## Idea

An agent plan is a short program that a model writes. It runs in amber, so it can be frozen at any `tool()` call. Every heavy step is an accrete tool, so it is pure and never needs to be frozen.

accrete keeps code by hash. amber produces snapshots of a running program. Together, a frozen plan gets a content address:

```
snapshot key = engine hash (dq.wasm) + snapshot hash + hashes of every kept tool the plan calls
```

When a plan is frozen after its setup, the next task can fork from that state instead of starting again.

## Split of work

| Part | Repository | Owner |
|---|---|---|
| Snapshot store: `POST /snapshots`, `GET /snapshots/:key` | accrete | accrete session |
| Experiment harness and receipt: `examples/fork-many` | amber | agreed with the amber session |
| amber core: `exportSnapshot`, `fork`, `EngineMismatch` | amber | no change needed |

The harness uses only the public amber API. It does not edit amber `src/`.

## Snapshot store

- `POST /snapshots` takes `{ engineSha, toolHashes, meta, snapshot }`. The snapshot is base64. accrete hashes the bytes, stores them in R2, and returns the key.
- `GET /snapshots/:key` returns the same fields. accrete checks the stored bytes against the hash before it returns them.
- Snapshots are never resumed by accrete. accrete only stores and returns them. amber resumes them.

## Experiment

1. A model writes an amber plan that reviews a diff. The plan calls the kept `diff-checklist` tool through accrete, then waits at `tool("model", ...)`.
2. Freeze the plan at that wait. Keep the snapshot in accrete.
3. Fork it 10 times. Each fork gets a different diff through its answer and finishes.
4. Fork it 3 times at the same wait with different model answers. The three forks must finish with three different results.

## Pass conditions

All of these come from one sealed receipt:

- After the first run, each fork uses 0 model tokens and 0 container-seconds for setup.
- The median time to fork and finish is smaller than the time to run the plan from the start.
- A fork with a different engine hash is refused.
- A fork whose recorded tool hash no longer matches the registry is refused.
- A fork that has a write tool is refused unless writes are allowed.
- The snapshot size is recorded.

## Falsification

If a fork is not clearly cheaper than a fresh run from the start, warm starts do not matter. Then this idea is only half true, and the page must say so.
