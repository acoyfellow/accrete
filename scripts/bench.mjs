import { mkdirSync, writeFileSync } from 'node:fs';
import { canonical, gitSha, placementOf, readJson, seal, sha256 } from './receipt.mjs';
import { sourceHash } from './source-hash.mjs';

const base = process.env.ACCRETE_URL;
const token = process.env.ACCRETE_TOKEN;
const [toolName, label = 'bench'] = process.argv.slice(2);
if (!base || !token || !toolName) throw new Error('usage: ACCRETE_URL=... ACCRETE_TOKEN=... node scripts/bench.mjs <tool> [label]');

const tool = readJson('bench/tools.json').find((entry) => entry.tool === toolName);
if (tool === undefined) throw new Error(`no bench tool ${toolName}`);
const golden = readJson('bench/golden.json');
const toolId = `bench-${tool.tool}`;

const call = async (method, path, body, ms) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  return { status: response.status, body: await response.json() };
};

const recipe = {
  name: toolId,
  packages: { [tool.package]: tool.version },
  cli: { package: tool.package, bin: tool.bin },
  entry: '',
  native: { bin: tool.bin, args: tool.cases[0].args },
  check: { args: tool.cases[0].args, files: tool.cases[0].files },
};

const runCase = async (index, pass) => {
  const one = tool.cases[index];
  const id = `${tool.tool}#${index}`;
  const expected = golden.find((entry) => entry.id === id);
  const started = Date.now();
  let result;
  try {
    const response = await call(
      'POST',
      '/task',
      {
        workspace: `${label}-${tool.tool}-${pass}-${index}`,
        seed: one.files,
        steps: [{ op: 'tool', name: toolId, args: one.args, inputs: Object.keys(one.files), stdoutTo: '__stdout__' }],
      },
      90_000,
    );
    result = response.body;
  } catch (error) {
    result = { ok: false, logs: [{ error: String(error.message ?? error), containerSeconds: 0, placement: 'none' }], files: {} };
  }
  const log = result.logs?.find((entry) => entry.op === 'tool') ?? result.logs?.at(-1) ?? {};
  const stdout = result.files?.['__stdout__'];
  return {
    id,
    pass,
    ok: result.ok === true && stdout === expected.stdout,
    placement: log.placement ?? 'none',
    toolHash: log.hash ?? null,
    containerSeconds: log.containerSeconds ?? 0,
    ms: Date.now() - started,
    inputHash: sha256(canonical({ args: one.args, files: one.files })),
    outputHash: stdout === undefined ? null : sha256(stdout),
    expectedHash: expected.stdoutHash,
    error: result.ok === true ? (stdout === expected.stdout ? undefined : 'output differs from golden') : String(log.error ?? 'failed').slice(0, 400),
  };
};

await call('PUT', '/recipes', recipe, 20_000);
await call('POST', '/forget', { names: [toolId] }, 20_000);
const cases = [];
for (const pass of ['cold', 'repeat']) for (const index of tool.cases.keys()) cases.push(await runCase(index, pass));

const receipt = seal({
  kind: 'bench-tool',
  label,
  tool: tool.tool,
  set: tool.set,
  package: `${tool.package}@${tool.version}`,
  gitSha: gitSha(),
  sourceHash: sourceHash(),
  placement: placementOf(base),
  at: new Date().toISOString(),
  cases,
});
mkdirSync(`bench/runs/${label}`, { recursive: true });
writeFileSync(`bench/runs/${label}/${tool.tool}.json`, `${JSON.stringify(receipt, null, 2)}\n`);
const passed = cases.filter((entry) => entry.ok).length;
console.log(`${tool.tool} [${tool.set}] ${passed}/${cases.length} cs=${cases.reduce((sum, entry) => sum + entry.containerSeconds, 0).toFixed(2)}${cases.find((entry) => entry.error) ? ` err=${cases.find((entry) => entry.error).error.slice(0, 160)}` : ''}`);
