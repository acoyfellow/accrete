import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { nativeStdout } from './native.mjs';

const base = process.env.ACCRETE_URL;
const token = process.env.ACCRETE_TOKEN;
const runLabel = process.argv[2] ?? 'run';
if (!base || !token) throw new Error('set ACCRETE_URL and ACCRETE_TOKEN');

const tasks = JSON.parse(readFileSync('tasks/tasks.json', 'utf8'));

const problemsFor = async (task, result) => {
  const problems = [];
  if (!result.ok) problems.push(`task failed: ${JSON.stringify(result.logs?.at(-1) ?? result)}`);
  for (const [path, content] of Object.entries(task.expect.files ?? {})) {
    if (result.files?.[path] !== content) problems.push(`${path} differs`);
  }
  for (const check of task.expect.native ?? []) {
    const expected = nativeStdout(check.tool, check.args[0], result.files ?? {});
    if (result.files?.[check.file] !== expected) problems.push(`${check.file} differs from native ${check.tool}`);
  }
  return problems;
};

const report = [];
const startedAt = new Date().toISOString();
for (const task of tasks) {
  const response = await fetch(`${base}/task`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
    body: JSON.stringify({ workspace: `${runLabel}-${task.id}`, seed: task.seed, steps: task.steps }),
  });
  const result = await response.json();
  const problems = await problemsFor(task, result);
  report.push({ id: task.id, pass: problems.length === 0, problems, logs: result.logs ?? [] });
}

const calls = report.flatMap((entry) => entry.logs);
const summary = {
  run: runLabel,
  at: new Date().toISOString(),
  passed: report.filter((entry) => entry.pass).length,
  total: report.length,
  placements: Object.fromEntries(['isolate', 'built-tool', 'container'].map((p) => [p, calls.filter((c) => c.placement === p).length])),
  containerSeconds: calls.reduce((sum, c) => sum + c.containerSeconds, 0),
  registryTools: [...new Set(calls.filter((c) => c.placement === 'built-tool').map((c) => `${c.tool}#${c.hash.slice(0, 12)}`))],
  builtThisRun: calls.filter((c) => c.build).map((c) => c.build),
  startedAt,
  finishedAt: new Date().toISOString(),
  tasks: report,
};
mkdirSync('proof/receipts', { recursive: true });
writeFileSync(`proof/receipts/${runLabel}.json`, JSON.stringify(summary, null, 2));
console.log(`${runLabel}: ${summary.passed}/${summary.total} placements=${JSON.stringify(summary.placements)} containerSeconds=${summary.containerSeconds} tools=${summary.registryTools.join(',')}`);
for (const entry of report) if (!entry.pass) console.log(`  FAIL ${entry.id}: ${entry.problems.join('; ')}`);
process.exit(summary.passed === summary.total ? 0 : 1);
