import { writeFileSync, mkdirSync } from 'node:fs';
import { selfSeed } from './self-source.mjs';

const base = process.env.ACCRETE_URL;
const token = process.env.ACCRETE_TOKEN;

const { seed, sources: sourceFiles } = selfSeed();

const steps = [
  { op: 'tool', name: 'tsc', args: ['-p', 'tsconfig.json'], inputs: Object.keys(seed), stdoutTo: 'reports/tsc.txt' },
];

const response = await fetch(`${base}/task`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    signal: AbortSignal.timeout(25_000),
  body: JSON.stringify({ workspace: `self-check-${Date.now()}`, seed, steps }),
});
const result = await response.json();
const tscReport = result.files?.['reports/tsc.txt'];
const toolCalls = (result.logs ?? []).filter((log) => log.op === 'tool');
const summary = {
  at: new Date().toISOString(),
  files: sourceFiles.length,
  ok: result.ok === true,
  tscClean: tscReport === '',
  tscReport,
  placements: toolCalls.map((log) => ({ tool: log.tool, placement: log.placement, containerSeconds: log.containerSeconds, ms: log.ms })),
  containerSeconds: toolCalls.reduce((sum, log) => sum + log.containerSeconds, 0),
  allBuiltTool: toolCalls.length === 1 && toolCalls.every((log) => log.placement === 'built-tool'),
  error: result.ok ? undefined : result.logs?.at(-1)?.error ?? result.error,
};
mkdirSync('proof/receipts', { recursive: true });
writeFileSync('proof/receipts/self-check.json', JSON.stringify(summary, null, 2));
console.log(`self-check: files=${summary.files} tscClean=${summary.tscClean} placements=${JSON.stringify(summary.placements)}`);
if (!summary.ok) console.log(`  error: ${summary.error}`);
if (summary.tscReport) console.log(summary.tscReport.slice(0, 2000));
process.exit(summary.ok && summary.tscClean && summary.allBuiltTool && summary.containerSeconds === 0 ? 0 : 1);
