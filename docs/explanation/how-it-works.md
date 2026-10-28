---
title: How accrete works
section: explanation
order: 2
description: Workspace, registry, builder, and the native-output check.
---

# How accrete works

accrete is one Worker with three Durable Objects, an R2 bucket, and a container class.

## The parts

- **Workspace** (Durable Object). Holds one task's files in SQLite. Runs `read`, `write`, and `edit` steps in the isolate. Sends `tool` steps to the registry.
- **Registry** (Durable Object + R2). Maps a tool name to a record: version, content hash, and check case. The bundle lives in R2 under its hash.
- **Builder** (container). Starts only on a registry miss. Installs the npm package, bundles it with esbuild into one ES module, runs the real CLI and the bundle on the check case, and stops.
- **Runner** (Worker Loader). Loads a bundle into a fresh isolate with no network and no bindings, and calls `run({ args, files })`.

## A tool call

1. The workspace asks the registry for the tool.
2. **Hit:** the runner loads the bundle by hash, checks the hash, and runs it. Placement `built-tool`, 0 container-seconds.
3. **Miss:** the builder container builds the bundle and compares its output with the real CLI on the check case. On a byte-for-byte match, the registry stores it. On a mismatch, the build is rejected and nothing is stored.

## Why the check matters

Bundling a CLI for an isolate changes its environment: no real file system, no `process.exit`, no `eval`. Some tools break quietly. The native-output check catches that before any agent uses the tool, so a lifted tool is either the same as the real one on the check case, or it does not exist.

## Why content hashes

A tool is immutable once registered. The runner refuses a bundle whose bytes do not match the stored hash. A new package version is a new tool. You can always tell which exact code produced an output from the `hash` in the log.
