---
title: Recipe format
section: reference
order: 2
description: Every field of an accrete recipe.
---

# Recipe format

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | Tool name used in `tool` steps |
| `packages` | `{ [pkg]: version }` | yes | npm packages to install. Pin exact versions. |
| `entry` | string | yes | ES module source exporting `run({ args, files })`. Use `""` with `cli` to bundle the package's own CLI. |
| `cli` | `{ package, bin }` | no | Bundle this package's `bin` as the tool, with a virtual file system |
| `native` | `{ bin, args }` | yes | How to run the real CLI for the check |
| `check` | `{ args, files }` | yes | One case. The build must print the same stdout as `native` on these files. |
| `nativeFiles` | `{ [path]: text }` | no | Extra files only the native run needs, such as a config file |
| `nativeFilter` | `"raw"` or `"eslint-json"` | no | How to normalize native output before comparing |
| `alias` | `{ [import]: path }` | no | Import aliases for the bundler |
| `embed` | `{ [name]: glob or globs }` | no | Package files to embed, read with `import x from 'accrete:embed/<name>'` |

## Tool contract

```ts
run({ args: string[], files: Record<string, string> }): Promise<{ stdout: string, files: Record<string, string> }>
```

The tool sees only the `files` you pass. It has no network, no environment variables, and no bindings.

## Names from the Pi extension and CLI

`lift()` names tools `lift-<package>-<version>` with every character other than `a-z`, `0-9` and `-` replaced by `-`. For example, `sql-formatter@15.4.5` becomes `lift-sql-formatter-15-4-5`.
