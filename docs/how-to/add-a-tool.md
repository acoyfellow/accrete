---
title: Add a tool with a recipe
section: how-to
order: 2
description: Register an npm CLI with accrete by pinning a version and giving one check case.
---

# Add a tool with a recipe

A recipe tells accrete which package to build and how to check the build. You do not need a recipe to use the Pi extension or the CLI, because they write one for you. Write one by hand when you want a stable tool name or a custom check case.

## 1. Write the recipe

```json
{
  "name": "sass",
  "packages": { "sass": "1.80.6" },
  "cli": { "package": "sass", "bin": "sass" },
  "entry": "",
  "native": { "bin": "sass", "args": ["--no-source-map", "a.scss"] },
  "check": {
    "args": ["--no-source-map", "a.scss"],
    "files": { "a.scss": "$c: #f38020;\n.a { color: $c; }\n" }
  }
}
```

- Pin an exact version. accrete stores tools by content hash, so a new version is a new tool.
- Make the check case use the features you rely on. accrete only registers the build if its output is byte-for-byte the same as the real CLI on this case.

## 2. Send it

```sh
curl -X PUT "$ACCRETE_URL/recipes" \
  -H "Authorization: Bearer $ACCRETE_TOKEN" \
  -H "content-type: application/json" \
  --data @sass.recipe.json
```

## 3. Use it

Call the tool by its `name` in a task. The first call builds it; see [HTTP API](/docs/reference/http-api/).

## If the build is rejected

accrete returns an error and does not list the tool when:

- The bundle prints different output from the real CLI on the check case.
- The CLI generates code at run time (`eval`, `new Function`) that accrete cannot map to a known function.
- The package needs a native binary.

The tool then stays a container tool. See [Limits](/docs/explanation/limits/).

Full field list: [Recipe format](/docs/reference/recipe/).
