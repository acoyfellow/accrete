import { readFileSync, writeFileSync } from 'node:fs';
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

const numbers = seal({
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
