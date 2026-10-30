import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const checks = [];
const check = (name, pass) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
};

const RECEIPT = 'bench/fork/latest.json';
check('sealed fork receipt exists', existsSync(RECEIPT));
const sealed = existsSync(RECEIPT) ? JSON.parse(readFileSync(RECEIPT, 'utf8')) : {};
const { sha256, ...body } = sealed;
check('receipt hash matches its content', sha256 === createHash('sha256').update(JSON.stringify(body, null, 2)).digest('hex'));
check('plan was written by a model', typeof sealed.plan?.source === 'string' && sealed.plan.source.includes('tool(') && typeof sealed.model === 'string');
check('snapshot was kept by content key', typeof sealed.snapshot?.key === 'string' && sealed.snapshot.key.length === 64 && sealed.snapshot.bytes > 0);
check('10 forks, each with 0 setup calls', Array.isArray(sealed.forks) && sealed.forks.length >= 10 && sealed.forks.every((fork) => fork.setupCalls === 0));
check('forks used 0 container-seconds', sealed.summary?.forkContainerSeconds === 0);
check('fork median is faster than a fresh run', sealed.summary?.forkMedianMs < sealed.summary?.freshMs);
check('3 branches finished with 3 different results', Array.isArray(sealed.branches) && new Set(sealed.branches).size === 3);
const named = (name) => sealed.checks?.find((entry) => entry.name === name)?.pass === true;
check('engine mismatch refused', named('fork with a different engine is refused'));
check('changed tool refused', named('fork whose tool changed since the freeze is refused'));
check('write tool refused', named('fork with a write tool is refused unless writes are allowed'));
check('every receipt check passed', Array.isArray(sealed.checks) && sealed.checks.length >= 11 && sealed.checks.every((entry) => entry.pass));

const page = readFileSync('docs/explanation/freeze-once-fork-many.md', 'utf8');
check('docs page cites the receipt and states the simulated setup', page.includes(RECEIPT) && page.includes(String(sealed.summary?.forkMedianMs)) && page.toLowerCase().includes('simulated'));

const ok = (command, args) => {
  try {
    execFileSync(command, args, { stdio: 'ignore', env: { ...process.env, ACCRETE_URL: process.env.ACCRETE_URL ?? 'x' } });
    return true;
  } catch {
    return false;
  }
};
check('typecheck passes', ok('npx', ['tsc', '--noEmit', '-p', '.']));
check('honesty gate passes', ok('node', ['scripts/honesty.mjs']));

const failed = checks.filter((entry) => !entry.pass).length;
console.log(failed === 0 ? `FORK GATE PASS: ${checks.length} checks` : `FORK GATE FAIL: ${failed} of ${checks.length}`);
process.exit(failed === 0 ? 0 : 1);
