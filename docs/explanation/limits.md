---
title: Limits and security model
section: explanation
order: 3
description: What accrete refuses to do, and why.
---

# Limits and security model

## It runs in your account

accrete is not a service someone else runs. You deploy it, you hold the token, and your tools and inputs stay in your account's Durable Objects and R2 bucket.

## Built tools are sealed

- No network. The runner isolate has no outbound fetch. A falsification test checks that a tool which tries to fetch fails.
- No secrets. The isolate gets no environment variables and no bindings.
- Immutable. A tampered bundle is refused because its hash no longer matches. A falsification test checks this.
- Checked. A build whose output differs from the real CLI is not registered. A falsification test checks this.

## What does not lift

- Tools that need a native binary (for example TypeScript 7, `esbuild` itself).
- Tools that generate code at run time with `eval` or `new Function`, unless the generated body is a known function. `prettier` 3 is rejected today.
- Tools that read files you do not pass in `inputs`, or that walk the file system.
- Tools whose output depends on time, randomness, or the machine.

These stay container tools. accrete reports the failure instead of guessing.

## Token scope

The bearer token can run tasks, add recipes, and forget tools. Treat it like a deploy key. The public routes are read-only.

## What is not proven yet

[`status.json`](/status.json) lists open claims. Today: total container cost over a long mixed run, and whether the Worker log measures builder cost the same way billing does.
