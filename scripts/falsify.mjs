import { mkdirSync, writeFileSync } from 'node:fs';
import { gitSha, placementOf, readJson, seal } from './receipt.mjs';
import { sourceHash } from './source-hash.mjs';

const base = process.env.ACCRETE_URL ?? 'http://localhost:8799';
const token = process.env.ACCRETE_TOKEN ?? 'local-dev';

const call = async (method, path, body, ms = 90_000) => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(ms),
  });
  return { status: response.status, body: await response.json() };
};

const json5 = readJson('recipes/json5.json');
const task = (workspace, name) => ({
  workspace,
  seed: { 'a.json5': "{a: 1, b: 'x',}\n" },
  steps: [{ op: 'tool', name, args: ['-s', '2', 'a.json5'], inputs: ['a.json5'], stdoutTo: 'out.json' }],
});
const toolLogs = (result) => (result.logs ?? []).filter((log) => log.op === 'tool');

const repeatUsesNoContainer = async () => {
  const name = 'falsify-json5';
  await call('PUT', '/recipes', { ...json5, name });
  await call('POST', '/forget', { names: [name] });
  const cold = (await call('POST', '/task', task(`falsify-cold-${Date.now()}`, name))).body;
  const repeat = (await call('POST', '/task', task(`falsify-repeat-${Date.now()}`, name))).body;
  const coldLog = toolLogs(cold)[0] ?? {};
  const repeatLog = toolLogs(repeat)[0] ?? {};
  const pass = cold.ok === true && coldLog.placement === 'container' && coldLog.containerSeconds > 0 && repeat.ok === true && repeatLog.placement === 'built-tool' && repeatLog.containerSeconds === 0 && repeat.files?.['out.json'] === cold.files?.['out.json'];
  return { pass, cold: { placement: coldLog.placement, containerSeconds: coldLog.containerSeconds }, repeat: { placement: repeatLog.placement, containerSeconds: repeatLog.containerSeconds, ms: repeatLog.ms } };
};

const tamperedBundleRefused = async () => {
  const name = 'falsify-json5';
  const tampered = await call('POST', '/api/test/tamper', { name });
  const run = (await call('POST', '/task', task(`falsify-tamper-${Date.now()}`, name))).body;
  const error = toolLogs(run)[0]?.error ?? run.logs?.at(-1)?.error ?? '';
  const pass = tampered.status === 200 && run.ok === false && error.includes('does not match its hash');
  await call('POST', '/forget', { names: [name] });
  return { pass, tamperedHash: tampered.body.hash, refusedWith: error.slice(0, 200) };
};

const networkToolFails = async () => {
  const name = 'falsify-network';
  const entry = "export const run = async ({ args }) => {\n  if (args[0] === 'probe') {\n    try {\n      const response = await fetch('https://example.com/');\n      return { stdout: `reached ${response.status}`, files: {} };\n    } catch (error) {\n      return { stdout: `blocked ${error.name}`, files: {} };\n    }\n  }\n  return { stdout: 'ok', files: {} };\n};\n";
  const recipe = { name, packages: {}, entry, native: { bin: 'true', args: [] }, check: { args: ['offline'], files: {} } };
  const registered = await call('POST', '/tools', { name, version: 'falsify', code: entry, check: { args: ['offline'], files: {}, stdout: 'ok' } });
  await call('PUT', '/recipes', recipe);
  const run = (await call('POST', '/task', { workspace: `falsify-net-${Date.now()}`, seed: {}, steps: [{ op: 'tool', name, args: ['probe'], inputs: [], stdoutTo: 'out.txt' }] })).body;
  const stdout = run.files?.['out.txt'] ?? '';
  const pass = registered.status === 200 && run.ok === true && stdout.startsWith('blocked') && !stdout.startsWith('reached');
  await call('POST', '/forget', { names: [name] });
  return { pass, stdout };
};

const badRecipeRejected = async () => {
  const name = 'falsify-bad';
  const bad = { ...json5, name, entry: "export const run = async () => ({ stdout: 'not json5 output', files: {} });\n" };
  const built = await call('POST', '/build', bad);
  const listed = (await call('GET', '/tools')).body.some((tool) => tool.name === name);
  const pass = built.status === 500 && String(built.body.error).includes('does not match native output') && !listed;
  return { pass, status: built.status, listed };
};

const tests = { repeatUsesNoContainer, tamperedBundleRefused, networkToolFails, badRecipeRejected };
const results = {};
for (const [name, test] of Object.entries(tests)) {
  try {
    results[name] = await test();
  } catch (error) {
    results[name] = { pass: false, error: String(error.message ?? error) };
  }
  console.log(`${results[name].pass ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(results[name])}`);
}
const receipt = seal({ kind: 'falsify', gitSha: gitSha(), sourceHash: sourceHash(), placement: placementOf(base), at: new Date().toISOString(), results });
mkdirSync('receipts', { recursive: true });
writeFileSync('receipts/falsify.json', `${JSON.stringify(receipt, null, 2)}\n`);
process.exit(Object.values(results).every((result) => result.pass) ? 0 : 1);
