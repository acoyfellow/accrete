import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { heldoutScore } from './objective.mjs';
import { readJson, sha256, verifySeal } from './receipt.mjs';

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`);
};

const loadRun = (label) => {
  const dir = `bench/runs/${label}`;
  const score = readJson(`${dir}/score.json`);
  const receipts = readdirSync(dir)
    .filter((name) => name.endsWith('.json') && name !== 'score.json')
    .map((name) => readJson(`${dir}/${name}`));
  return { score, receipts };
};

const golden = readJson('bench/golden.json');
const goldenHash = sha256(JSON.stringify(golden, null, 2));
const ledger = readJson('bench/ledger.json');

const runOk = (label) => {
  const { score, receipts } = loadRun(label);
  const sealed = verifySeal(score) && receipts.every(verifySeal);
  const linked = score.receipts.every((entry) => receipts.some((receipt) => receipt.digest === entry.digest));
  const fields = receipts.every((receipt) => typeof receipt.gitSha === 'string' && typeof receipt.at === 'string' && (receipt.placement === 'local' || receipt.placement === 'remote') && receipt.cases.every((entry) => 'inputHash' in entry && 'outputHash' in entry && 'toolHash' in entry));
  const sameGolden = score.goldenHash === goldenHash;
  const outputsMatch = receipts.every((receipt) => receipt.cases.every((entry) => entry.ok === (entry.outputHash === entry.expectedHash)));
  return { pass: sealed && linked && fields && sameGolden && outputsMatch, sealed, linked, fields, sameGolden, outputsMatch };
};

const frozen = readJson('bench/frozen.json');
check('held-out set frozen', sha256(readFileSync('bench/tools.json', 'utf8')) === frozen.toolsHash && goldenHash === frozen.goldenHash);

const labels = ['baseline', ...ledger.kept.map((row) => row.label)];
for (const label of labels) check(`receipts verify: ${label}`, existsSync(`bench/runs/${label}/score.json`) && runOk(label).pass, existsSync(`bench/runs/${label}/score.json`) ? runOk(label) : { missing: true });

check('bench/score.json exists and is sealed', existsSync('bench/score.json') && verifySeal(readJson('bench/score.json')));

let previous = heldoutScore(loadRun('baseline').score);
let improvements = 0;
for (const row of ledger.kept) {
  if (!existsSync(`bench/runs/${row.label}/score.json`)) continue;
  const { score } = loadRun(row.label);
  const value = heldoutScore(score);
  const noRegression = score.train.passRate >= row.before.trainPassRate && score.heldout.repeatContainerCalls === 0;
  const honest = Math.abs(row.after.heldoutScore - value) < 1e-9 && Math.abs(row.before.heldoutScore - previous) < 1e-9;
  if (value > previous && noRegression && honest) improvements += 1;
  check(`kept ${row.label}: held-out ${previous.toFixed(1)} -> ${value.toFixed(1)}`, value > previous && noRegression && honest, { noRegression, honest });
  previous = value;
}
check('held-out improved at least 3 times over baseline', improvements >= 3, { improvements });

const falsify = readJson('receipts/falsify.json');
check('falsification receipt sealed', verifySeal(falsify));
for (const [name, result] of Object.entries(falsify.results)) check(`falsify: ${name}`, result.pass === true);

const site = readJson('client/src/numbers.json');
check('site numbers come from receipts', verifySeal(site) && site.sources.every((source) => existsSync(source.path) && sha256(readFileSync(source.path, 'utf8')) === source.sha256), { sources: site.sources.length });
const view = readFileSync('client/src/view.ts', 'utf8');
const literal = view.match(new RegExp('[0-9]+[.][0-9]+s', 'g')) ?? [];
check('view has no hand-typed timing literals', literal.length === 0, { literal });

const failed = checks.filter((entry) => !entry.pass);
console.log(failed.length === 0 ? `HONESTY PASS: ${checks.length} checks` : `HONESTY FAIL: ${failed.length}/${checks.length}`);
process.exit(failed.length === 0 ? 0 : 1);
