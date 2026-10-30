export const scriptNumbers = {
  "receipt": "bench/scripts/latest.json",
  "receiptSha256": "7b229efef29d93ece46a0c546018a9f120c921fc4d9ee4d36f9c021ac90a8f56",
  "at": "2026-10-30T13:35:17.767Z",
  "model": "@cf/moonshotai/kimi-k2.6",
  "name": "diff-checklist-mvv0kxa7",
  "source": "export const run = async ({ args, files }) => {\n  const patch = files[\"diff.patch\"] || \"\";\n  const lines = patch.split(\"\\n\");\n  \n  const fileStats = [];\n  let currentFile = null;\n  let currentAdded = 0;\n  let currentRemoved = 0;\n  let totalAdded = 0;\n  let totalRemoved = 0;\n  \n  for (const line of lines) {\n    if (line.startsWith(\"diff --git \")) {\n      if (currentFile !== null) {\n        fileStats.push({ path: currentFile, added: currentAdded, removed: currentRemoved });\n        totalAdded += currentAdded;\n        totalRemoved += currentRemoved;\n      }\n      currentFile = null;\n      currentAdded = 0;\n      currentRemoved = 0;\n    } else if (line.startsWith(\"+++ b/\")) {\n      currentFile = line.slice(6);\n    } else if (line.startsWith(\"--- a/\") || line.startsWith(\"--- /dev/null\")) {\n      // ignore\n    } else if (line.startsWith(\"+++\")) {\n      // ignore other +++ lines\n    } else if (line.startsWith(\"+\")) {\n      currentAdded++;\n    } else if (line.startsWith(\"-\")) {\n      currentRemoved++;\n    }\n  }\n  \n  if (currentFile !== null) {\n    fileStats.push({ path: currentFile, added: currentAdded, removed: currentRemoved });\n    totalAdded += currentAdded;\n    totalRemoved += currentRemoved;\n  }\n  \n  let stdout = \"\";\n  for (const stat of fileStats) {\n    stdout += `- [ ] ${stat.path} (+${stat.added} -${stat.removed})\\n`;\n  }\n  stdout += `${fileStats.length} files, +${totalAdded} -${totalRemoved}\\n`;\n  \n  return { stdout, files: {} };\n};\n",
  "sourceLines": 48,
  "sourceSha256": "05d52f9ee412108f53c1cb0396f7abd4b4f5512c776ff41320eeb77ae14acc23",
  "modelMs": 16331,
  "firstKeepContainerSeconds": 6.569,
  "firstKeepMs": 7256,
  "repeatMedianMs": 127,
  "repeatCount": 5,
  "repeatContainerSeconds": 0,
  "repeatModelTokens": 0,
  "checks": 8
} as const;
