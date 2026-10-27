import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gitSha, readJson, sha256 } from './receipt.mjs';
import { heldoutScore } from './objective.mjs';


const [action, label, ...words] = process.argv.slice(2);

if (action === 'freeze') {
  const golden = readJson('bench/golden.json');
  writeFileSync('bench/frozen.json', `${JSON.stringify({ toolsHash: sha256(readFileSync('bench/tools.json', 'utf8')), goldenHash: sha256(JSON.stringify(golden, null, 2)) }, null, 2)}\n`);
  if (!existsSync('bench/ledger.json')) writeFileSync('bench/ledger.json', `${JSON.stringify({ kept: [], rejected: [] }, null, 2)}\n`);
  console.log('frozen');
  process.exit(0);
}

const ledger = readJson('bench/ledger.json');
const lastLabel = ledger.kept.at(-1)?.label ?? 'baseline';
const before = readJson(`bench/runs/${lastLabel}/score.json`);
const after = readJson(`bench/runs/${label}/score.json`);
const row = {
  label,
  change: words.join(' '),
  gitSha: gitSha(),
  scoreDigest: after.digest,
  before: { label: lastLabel, heldoutScore: heldoutScore(before), heldoutCoverage: before.heldout.coverage, trainPassRate: before.train.passRate },
  after: { heldoutScore: heldoutScore(after), heldoutCoverage: after.heldout.coverage, trainPassRate: after.train.passRate, repeatP50Ms: after.heldout.repeatP50Ms, repeatCsPerTask: after.heldout.containerSecondsPerTask.repeat },
  at: new Date().toISOString(),
};
const improved = row.after.heldoutScore > row.before.heldoutScore && after.train.passRate >= before.train.passRate && after.heldout.repeatContainerCalls === 0;
(improved ? ledger.kept : ledger.rejected).push(row);
writeFileSync('bench/ledger.json', `${JSON.stringify(ledger, null, 2)}\n`);
console.log(`${improved ? 'KEPT' : 'REJECTED'} ${label}: held-out ${row.before.heldoutScore.toFixed(1)} -> ${row.after.heldoutScore.toFixed(1)}`);
process.exit(improved ? 0 : 1);
