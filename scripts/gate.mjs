import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = process.env.ACCRETE_URL;
const token = process.env.ACCRETE_TOKEN;
const COLD = ['json5', 'tsc'];
const RECIPES = ['marked', 'yaml2json', 'json5', 'tsc'];
const SEEDED = ['marked', 'yaml2json'];
const LIMIT_SECONDS = { api: 60, run: 30, selfCheck: 30 };

const bounded = (seconds, args, options = {}) => execFileSync('perl', ['-e', 'alarm shift; exec @ARGV or die', String(seconds), 'node', ...args], options);
const api = async (method, path, body) => {
  const args = ['scripts/api.mjs', method, path];
  if (body !== undefined) {
    mkdirSync('dist', { recursive: true });
    writeFileSync('dist/gate-body.json', JSON.stringify(body));
    args.push('dist/gate-body.json');
  }
  try {
    return JSON.parse(bounded(LIMIT_SECONDS.api, args, { encoding: 'utf8' }));
  } catch (error) {
    return { status: 0, body: { error: `${method} ${path} did not finish in ${LIMIT_SECONDS.api}s: ${error.signal ?? error.status}` } };
  }
};

const recipe = (name) => JSON.parse(readFileSync(`recipes/${name}.json`, 'utf8'));
const node = (seconds, script, ...args) => {
  try {
    bounded(seconds, [script, ...args], { stdio: 'inherit' });
    return true;
  } catch {
    return false;
  }
};
const receipt = (name) => JSON.parse(readFileSync(`proof/receipts/${name}.json`, 'utf8'));
const results = {};
const report = (check, pass, detail) => {
  results[check] = { pass, ...detail };
  console.log(`${pass ? 'PASS' : 'FAIL'} check ${check}: ${JSON.stringify(detail)}`);
};

for (const name of RECIPES) {
  const put = await api('PUT', '/recipes', recipe(name));
  if (put.status !== 200) throw new Error(`recipe ${name}: ${JSON.stringify(put.body)}`);
}
const listed = (await api('GET', '/tools')).body.map((tool) => tool.name);
for (const name of SEEDED.filter((seeded) => !listed.includes(seeded))) {
  const built = await api('POST', '/build', recipe(name));
  if (built.status !== 200) throw new Error(`seed ${name}: ${JSON.stringify(built.body)}`);
}
const forgotten = await api('POST', '/forget', { names: COLD });
console.log(`cold start: forgot ${forgotten.body.removed} registry rows for ${COLD.join(', ')}`);

const bad = { ...recipe('json5'), name: 'json5-bad', entry: "export const run = async () => ({ stdout: 'not json5 output', files: {} });\n" };
const rejected = await api('POST', '/build', bad);
const badListed = (await api('GET', '/tools')).body.some((tool) => tool.name === 'json5-bad');

const builds = {};
for (const name of ['tsc']) {
  const built = await api('POST', '/build', recipe(name));
  builds[name] = built.status === 200 ? built.body.build : { error: built.body.error };
}
report(1, rejected.status === 500 && !badListed && Object.values(builds).every((build) => build.nativeMatchesBuilt && build.isolateMatchesNative && build.containerSeconds > 0), {
  builds,
  badRecipeRejected: rejected.status === 500,
  badRecipeListed: badListed,
});

const runsPass = [1, 2, 3].map((run) => node(LIMIT_SECONDS.run, 'scripts/run-tasks.mjs', `gate-run-${run}`));
const runs = [1, 2, 3].map((run) => receipt(`gate-run-${run}`));
const cold = runs[0].builtThisRun;
const selfPass = node(LIMIT_SECONDS.selfCheck, 'scripts/self-check.mjs');

report(2, runs[0].containerSeconds > 0 && cold.every((build) => build.containerSeconds > 0), {
  workerLoggedRun1Seconds: runs[0].containerSeconds,
  run1Builds: cold.map((build) => ({ name: build.name, containerSeconds: build.containerSeconds })),
});

report(3, runsPass.every(Boolean) && runs.every((run) => run.passed === 6 && run.total === 6) && cold.some((build) => build.name === 'json5') && runs[2].containerSeconds === 0 && runs[2].placements.container === 0 && runs[2].registryTools.length >= 2, {
  passed: runs.map((run) => `${run.passed}/${run.total}`),
  coldToolsRun1: cold.map((build) => build.name),
  run3WorkerContainerSeconds: runs[2].containerSeconds,
  run3RegistryTools: runs[2].registryTools,
});

const self = receipt('self-check');
report(4, selfPass, { files: self.files, tscClean: self.tscClean, placements: self.placements, containerSeconds: self.containerSeconds });

mkdirSync('proof/receipts', { recursive: true });
writeFileSync('proof/receipts/gate.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const allPass = [1, 2, 3, 4].every((check) => results[check]?.pass);
console.log(allPass ? 'GATE PASS: checks 1, 2, 3, 4' : 'GATE FAIL');
process.exit(allPass ? 0 : 1);
