import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { readJson, seal, sha256, verifySeal } from './receipt.mjs';

const label = process.argv[2] ?? 'bench';
const dir = `bench/runs/${label}`;
const tools = readJson('bench/tools.json');
const golden = readJson('bench/golden.json');

const receipts = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => readJson(`${dir}/${name}`))
  : [];
const bad = receipts.filter((receipt) => !verifySeal(receipt)).map((receipt) => receipt.tool);
if (bad.length > 0) throw new Error(`receipt seal broken for ${bad.join(', ')}`);

const median = (values) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)];
};

const summarize = (set) => {
  const listed = tools.filter((tool) => tool.set === set);
  const rows = listed.map((tool) => receipts.find((receipt) => receipt.tool === tool.tool));
  const cases = rows.flatMap((row) => row?.cases ?? []);
  const cold = cases.filter((entry) => entry.pass === 'cold');
  const repeat = cases.filter((entry) => entry.pass === 'repeat');
  const covered = listed.filter((tool, index) => {
    const row = rows[index];
    return row !== undefined && row.cases.length === tool.cases.length * 2 && row.cases.every((entry) => entry.ok && entry.outputHash === entry.expectedHash);
  });
  const goldenCases = golden.filter((entry) => entry.set === set).length * 2;
  return {
    tools: listed.length,
    covered: covered.map((tool) => tool.tool),
    coverage: covered.length / listed.length,
    passRate: cases.filter((entry) => entry.ok).length / goldenCases,
    containerSecondsPerTask: {
      cold: cold.reduce((sum, entry) => sum + entry.containerSeconds, 0) / Math.max(1, cold.length),
      repeat: repeat.reduce((sum, entry) => sum + entry.containerSeconds, 0) / Math.max(1, repeat.length),
    },
    repeatContainerCalls: repeat.filter((entry) => entry.placement === 'container').length,
    repeatP50Ms: median(repeat.filter((entry) => entry.ok).map((entry) => entry.ms)),
    failures: cases.filter((entry) => !entry.ok).map((entry) => `${entry.id}/${entry.pass}: ${entry.error}`),
  };
};

const score = seal({
  kind: 'bench-score',
  label,
  goldenHash: sha256(JSON.stringify(golden, null, 2)),
  receipts: receipts.map((receipt) => ({ tool: receipt.tool, digest: receipt.digest, gitSha: receipt.gitSha, sourceHash: receipt.sourceHash, placement: receipt.placement, at: receipt.at })),
  train: summarize('train'),
  heldout: summarize('heldout'),
  at: new Date().toISOString(),
});
writeFileSync(`${dir}/score.json`, `${JSON.stringify(score, null, 2)}\n`);
writeFileSync('bench/score.json', `${JSON.stringify(score, null, 2)}\n`);
const line = (name, part) =>
  `${name}: coverage ${part.covered.length}/${part.tools} pass ${(part.passRate * 100).toFixed(0)}% cs/task cold ${part.containerSecondsPerTask.cold.toFixed(2)} repeat ${part.containerSecondsPerTask.repeat.toFixed(2)} p50 ${part.repeatP50Ms}ms`;
console.log(line('train', score.train));
console.log(line('heldout', score.heldout));
