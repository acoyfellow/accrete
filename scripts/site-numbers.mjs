import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { heldoutScore } from './objective.mjs';
import { readJson, seal, sha256 } from './receipt.mjs';

const ledger = readJson('bench/ledger.json');
const latest = ledger.kept.at(-1)?.label ?? 'baseline';
const paths = ['bench/runs/baseline/score.json', `bench/runs/${latest}/score.json`, 'receipts/falsify.json', 'bench/ledger.json'];
const [baseline, current, falsify] = paths.map(readJson);

const seconds = (value) => `${value.toFixed(2)}s`;
const percent = (value) => `${Math.round(value * 100)}%`;
const part = (score) => ({
  coverage: `${score.heldout.covered.length}/${score.heldout.tools}`,
  trainCoverage: `${score.train.covered.length}/${score.train.tools}`,
  passRate: percent(score.heldout.passRate),
  coldCs: seconds(score.heldout.containerSecondsPerTask.cold),
  repeatCs: seconds(score.heldout.containerSecondsPerTask.repeat),
  repeatP50: score.heldout.repeatP50Ms === null ? 'n/a' : `${score.heldout.repeatP50Ms} ms`,
  score: heldoutScore(score).toFixed(1),
  tools: [...score.train.covered, ...score.heldout.covered],
});

const runDir = `bench/runs/${latest}`;
const toolRows = readdirSync(runDir)
  .filter((name) => name.endsWith('.json') && name !== 'score.json')
  .map((name) => readJson(`${runDir}/${name}`))
  .map((receipt) => {
    const cold = receipt.cases.filter((entry) => entry.pass === 'cold');
    const repeat = receipt.cases.filter((entry) => entry.pass === 'repeat');
    const ok = receipt.cases.length > 0 && receipt.cases.every((entry) => entry.ok);
    const coldCs = cold.reduce((sum, entry) => sum + entry.containerSeconds, 0);
    const repeatMs = repeat.length === 0 ? null : Math.max(...repeat.map((entry) => entry.ms));
    const coldMs = cold.length === 0 ? null : Math.max(...cold.map((entry) => entry.ms));
    return { tool: receipt.tool, set: receipt.set, ok, coldCs: seconds(coldCs), coldMs, repeatCs: seconds(repeat.reduce((sum, entry) => sum + entry.containerSeconds, 0)), repeatMs, speedup: ok && repeatMs ? `${Math.round(coldMs / repeatMs)}×` : '—' };
  })
  .sort((first, second) => Number(second.ok) - Number(first.ok) || first.tool.localeCompare(second.tool));
paths.push(...readdirSync(runDir).filter((name) => name.endsWith('.json') && name !== 'score.json').map((name) => `${runDir}/${name}`));

const numbers = seal({
  toolRows,
  kind: 'site-numbers',
  baseline: part(baseline),
  current: part(current),
  kept: ledger.kept.map((row) => ({ label: row.label, change: row.change, before: row.before.heldoutScore.toFixed(1), after: row.after.heldoutScore.toFixed(1) })),
  falsify: Object.entries(falsify.results).map(([name, result]) => ({ name, pass: result.pass === true })),
  repeatCsFalsify: seconds(falsify.results.repeatUsesNoContainer?.repeat?.containerSeconds ?? Number.NaN),
  sources: paths.map((path) => ({ path, sha256: sha256(readFileSync(path, 'utf8')) })),
});
writeFileSync('client/src/numbers.json', `${JSON.stringify(numbers, null, 2)}\n`);
console.log(`site numbers from ${latest}: held-out ${numbers.current.coverage}, repeat ${numbers.current.repeatCs}`);
