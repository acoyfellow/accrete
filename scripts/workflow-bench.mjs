import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { lift, configFromEnv } from '../extensions/pi/client.mjs';
import { gitSha, placementOf, readJson, seal, sha256 } from './receipt.mjs';

const WORKFLOWS = [
  { id: 'scss-on-save', title: 'Compile SCSS on every save', tool: 'sass' },
  { id: 'minify-before-commit', title: 'Minify a bundle before each commit', tool: 'terser' },
  { id: 'format-sql-migrations', title: 'Format SQL migrations', tool: 'sql-formatter' },
  { id: 'yaml-config-to-json', title: 'Convert YAML config to JSON', tool: 'js-yaml' },
  { id: 'markdown-to-html', title: 'Render Markdown docs to HTML', tool: 'marked' },
  { id: 'semver-range-check', title: 'Check versions against a range', tool: 'semver' },
];

const REPEATS = Number(process.env.WORKFLOW_REPEATS ?? 10);
const label = process.argv[2] ?? 'workflows';
const config = configFromEnv();
if (!config.ready) throw new Error('set ACCRETE_URL and ACCRETE_TOKEN');

const tools = readJson('bench/tools.json');
const median = (values) => [...values].sort((first, second) => first - second)[Math.floor(values.length / 2)];

const runLocal = (tool, one) => {
  const dir = mkdtempSync(join(tmpdir(), 'accrete-wf-'));
  for (const [path, content] of Object.entries(one.files)) writeFileSync(join(dir, path), content);
  const started = Date.now();
  const stdout = execFileSync('npx', ['-y', '-p', `${tool.package}@${tool.version}`, tool.bin, ...one.args], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  return { ms: Date.now() - started, outputHash: sha256(stdout) };
};

const runAccrete = async (tool, one, dir) => {
  const result = await lift(config, { pkg: tool.package, version: tool.version, bin: tool.bin, args: one.args, inputs: Object.keys(one.files), cwd: dir, write: false });
  return { ms: result.ms, placement: result.placement, containerSeconds: result.containerSeconds, ok: result.ok, outputHash: sha256(result.stdout) };
};

const retry = async (attempt, tries = 3) => {
  for (let index = 1; ; index += 1) {
    try {
      return await attempt();
    } catch (error) {
      if (index >= tries) throw error;
      await new Promise((done) => setTimeout(done, 1500 * index));
    }
  }
};

const results = [];
for (const workflow of WORKFLOWS) {
  const tool = tools.find((entry) => entry.tool === workflow.tool);
  const one = tool.cases[0];
  const dir = mkdtempSync(join(tmpdir(), 'accrete-wf-in-'));
  for (const [path, content] of Object.entries(one.files)) writeFileSync(join(dir, path), content);
  runLocal(tool, one);
  const local = [];
  for (let index = 0; index < REPEATS; index += 1) local.push(runLocal(tool, one));
  await retry(() => fetch(`${config.url}/forget`, { method: 'POST', headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ names: [`lift-${tool.package}-${tool.version}`.replace(new RegExp('[^a-z0-9-]', 'g'), '-')] }) }));
  const cold = await retry(() => runAccrete(tool, one, dir));
  const repeat = [];
  for (let index = 0; index < REPEATS; index += 1) repeat.push(await retry(() => runAccrete(tool, one, dir)));
  const sameOutput = repeat.every((entry) => entry.outputHash === local[0].outputHash) && cold.outputHash === local[0].outputHash;
  const row = {
    ...workflow,
    package: `${tool.package}@${tool.version}`,
    args: one.args,
    repeats: REPEATS,
    local: { p50Ms: median(local.map((entry) => entry.ms)), totalMs: local.reduce((sum, entry) => sum + entry.ms, 0) },
    cold: { ms: cold.ms, placement: cold.placement, containerSeconds: cold.containerSeconds },
    repeat: {
      p50Ms: median(repeat.map((entry) => entry.ms)),
      totalMs: repeat.reduce((sum, entry) => sum + entry.ms, 0),
      containerSeconds: repeat.reduce((sum, entry) => sum + entry.containerSeconds, 0),
      allNoBoot: repeat.every((entry) => entry.placement === 'built-tool'),
    },
    sameOutput,
    ok: cold.ok && repeat.every((entry) => entry.ok) && sameOutput,
  };
  results.push(row);
  console.log(`${workflow.id}: local p50 ${row.local.p50Ms}ms · cold ${cold.ms}ms (${cold.containerSeconds}s) · repeat p50 ${row.repeat.p50Ms}ms · same=${sameOutput}`);
}

const receipt = seal({ kind: 'workflow-bench', label, gitSha: gitSha(), placement: placementOf(config.url), at: new Date().toISOString(), host: { node: process.version, platform: process.platform }, results });
mkdirSync('bench/workflows', { recursive: true });
writeFileSync(`bench/workflows/${label}.json`, `${JSON.stringify(receipt, null, 2)}\n`);
console.log(`wrote bench/workflows/${label}.json`);
