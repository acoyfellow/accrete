---
title: Documentation
section: overview
order: 0
description: accrete is a Cloudflare Worker you deploy to your own account. Your agents call it instead of booting a container for every npm CLI.
---

# Documentation

accrete is a Cloudflare Worker that **you deploy to your own account**. It is not a hosted service.

Your coding agents call it instead of running `npx` or booting a container. The first call to a CLI such as `sass` or `terser` builds that tool once in a short-lived container. accrete checks the build against the real CLI and stores it by content hash. After that, every call runs the saved copy in a Worker isolate with no boot, no network, and no secrets.

On the frozen bench, {{HELDOUT}} held-out tools build and a repeat run uses {{REPEAT_CS}} of container time.

## Start here

- **Tutorial** — [Deploy accrete and lift your first tool](/docs/tutorials/first-deploy/). Fifteen minutes, from clone to a 70 ms repeat call.
- **How-to** — [Use accrete from Pi](/docs/how-to/use-with-pi/). Install the extension so your agent lifts repeated CLI work to your Worker.
- **How-to** — [Add a tool with a recipe](/docs/how-to/add-a-tool/). Pin a package, give a check case, and let accrete verify it.
- **How-to** — [Call accrete from any agent](/docs/how-to/call-from-any-agent/). One HTTP request from any language.
- **Reference** — [HTTP API](/docs/reference/http-api/). Every route, body, and response.
- **Reference** — [Recipe format](/docs/reference/recipe/). Every recipe field.
- **Reference** — [Pi extension](/docs/reference/pi-extension/). The `accrete_run` tool, the `/accrete` command, and receipts.
- **Explanation** — [Which workflows benefit](/docs/explanation/workflows/). Measured laptop-vs-accrete numbers for six real workflows.
- **Explanation** — [How accrete works](/docs/explanation/how-it-works/). Workspace, registry, builder, and the native-output check.
- **Explanation** — [Limits and security model](/docs/explanation/limits/). What accrete refuses to do, and why.

## Is it for me?

Use accrete when an agent runs the **same deterministic file transform many times**: compile, format, minify, convert, render. Do not use it for tools that need the network, a native binary, or files outside the inputs you send.
