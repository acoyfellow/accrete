import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const checks = [];
const check = (name, pass) => {
  checks.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}`);
};

const RECEIPT = 'bench/scripts/latest.json';
check('sealed scripts receipt exists', existsSync(RECEIPT));
const sealed = existsSync(RECEIPT) ? JSON.parse(readFileSync(RECEIPT, 'utf8')) : {};
const { sha256, ...body } = sealed;
check('receipt hash matches its content', sha256 === createHash('sha256').update(JSON.stringify(body, null, 2)).digest('hex'));
check('receipt records a model-written source', typeof sealed.script?.source === 'string' && sealed.script.source.includes('export const run') && typeof sealed.model === 'string');
check('first keep used the container and passed every check', sealed.keep?.kept === 'new' && sealed.keep.containerSeconds > 0 && Object.values(sealed.keep.checks ?? {}).every(Boolean));
check('every repeat ran from the registry with 0 container-seconds', Array.isArray(sealed.repeats) && sealed.repeats.length >= 3 && sealed.repeats.every((run) => run.placement === 'built-tool' && run.containerSeconds === 0));
check('every receipt check passed', Array.isArray(sealed.checks) && sealed.checks.length >= 8 && sealed.checks.every((entry) => entry.pass));

const numbers = readFileSync('client/src/numbers.ts', 'utf8');
check('site numbers come from the scripts receipt', numbers.includes(String(sealed.summary?.repeatMedianMs)) && numbers.includes(String(sealed.summary?.firstKeepContainerSeconds)) && numbers.includes(sealed.script?.sourceSha256 ?? 'missing'));

const view = readFileSync('client/src/view.ts', 'utf8');
const heroStart = view.indexOf('const hero =');
const hero = view.slice(heroStart, view.indexOf('\nconst ', heroStart + 10));
check('hero leads with scripts the agent writes', new RegExp('WRITES', 'i').test(hero) && new RegExp('KEEPS', 'i').test(hero));
const main = view.slice(view.indexOf('Ready: ('));
check('script demo is the first section after the hero', main.indexOf('scriptDemo(') > -1 && main.indexOf('scriptDemo(') < main.indexOf('demo(h, model'));

const demo = readFileSync('src/demo.ts', 'utf8');
check('live demo has a kept-script route', demo.includes("'/api/script/run'"));

const output = (command, args) => {
  try {
    return { ok: true, text: execFileSync(command, args, { encoding: 'utf8', env: { ...process.env, ACCRETE_URL: process.env.ACCRETE_URL ?? 'x' } }) };
  } catch (error) {
    return { ok: false, text: String(error.stdout ?? error.message) };
  }
};
check('typecheck passes', output('npx', ['tsc', '--noEmit', '-p', '.']).ok);
check('honesty gate passes', output('node', ['scripts/honesty.mjs']).ok);

const failed = checks.filter((entry) => !entry.pass).length;
console.log(failed === 0 ? `SCRIPTS GATE PASS: ${checks.length} checks` : `SCRIPTS GATE FAIL: ${failed} of ${checks.length}`);
process.exit(failed === 0 ? 0 : 1);
