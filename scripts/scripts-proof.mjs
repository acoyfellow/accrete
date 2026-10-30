import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ACCRETE_URL = process.env.ACCRETE_URL ?? 'https://accrete.customer0.dev';
const ACCRETE_TOKEN = process.env.ACCRETE_TOKEN ?? readFileSync(join(homedir(), '.accrete/token'), 'utf8').trim();
const MODEL = process.env.ACCRETE_MODEL ?? '@cf/moonshotai/kimi-k2.6';
const REPEATS = 5;
const OUT = 'bench/scripts/latest.json';

const TASK = `Write an ES module in plain JavaScript with no imports.
It must export: export const run = async ({ args, files }) => ({ stdout, files: {} })
Task: files["diff.patch"] is a unified git diff. Produce a markdown review checklist.
For each changed file, in the order it appears, print one line: "- [ ] <path> (+<added> -<removed>)".
Count added lines that start with "+" and removed lines that start with "-", excluding the "+++" and "---" header lines.
Then print a final line: "<N> files, +<total added> -<total removed>".
Every line ends with a newline. Reply with only the code, no fences, no prose.`;

const SAMPLE = [
  'diff --git a/src/a.ts b/src/a.ts',
  '--- a/src/a.ts',
  '+++ b/src/a.ts',
  '@@ -1,2 +1,3 @@',
  ' keep',
  '-old',
  '+new',
  '+added',
  'diff --git a/README.md b/README.md',
  '--- a/README.md',
  '+++ b/README.md',
  '@@ -1 +1 @@',
  '-hi',
  '+hello',
  '',
].join('\n');

const EXPECTED = '- [ ] src/a.ts (+2 -1)\n- [ ] README.md (+1 -1)\n2 files, +3 -2\n';

const SECOND = [
  'diff --git a/x.js b/x.js',
  '--- a/x.js',
  '+++ b/x.js',
  '@@ -1,3 +1,1 @@',
  '-a',
  '-b',
  '-c',
  '+d',
  '',
].join('\n');

const SECOND_EXPECTED = '- [ ] x.js (+1 -3)\n1 files, +1 -3\n';

const gatewayConfig = () => {
  const file = JSON.parse(readFileSync(join(homedir(), '.config/odds/config.json'), 'utf8'));
  if (file.accountId === undefined) throw new Error('no accountId in ~/.config/odds/config.json');
  return { accountId: file.accountId, gateway: file.gateway ?? 'default' };
};

const gatewayToken = () => execFileSync('security', ['find-generic-password', '-a', process.env.USER ?? '', '-s', 'odds-gateway', '-w'], { encoding: 'utf8' }).trim();

const stripFences = (text) => text.replace(new RegExp('^\\s*```[a-z]*\\s*'), '').replace(new RegExp('\\s*```\\s*$'), '').trim() + '\n';

const writeScript = async () => {
  const { accountId, gateway } = gatewayConfig();
  const started = Date.now();
  const response = await fetch(`https://gateway.ai.cloudflare.com/v1/${accountId}/${gateway}/workers-ai/${MODEL}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${gatewayToken()}`, 'content-type': 'application/json', 'cf-aig-skip-cache': 'true' },
    body: JSON.stringify({ messages: [{ role: 'user', content: TASK }], max_tokens: 1500, temperature: 0, chat_template_kwargs: { thinking: false } }),
    signal: AbortSignal.timeout(180_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`model ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  const result = body.result ?? {};
  const text = result.choices?.[0]?.message?.content ?? result.response ?? '';
  return { source: stripFences(String(text)), ms: Date.now() - started, usage: result.usage ?? null };
};

const accrete = async (path, payload) => {
  const started = Date.now();
  const response = await fetch(`${ACCRETE_URL}${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ACCRETE_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path} ${response.status}: ${JSON.stringify(body).slice(0, 400)}`);
  return { body, clientMs: Date.now() - started };
};

const checks = [];
const check = (name, pass, detail) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` · ${detail}`}`);
};

const name = `diff-checklist-${Date.now().toString(36)}`;
const written = await writeScript();
check('model wrote a script', written.source.includes('export const run'), `${written.ms} ms, ${written.source.length} chars`);

const kept = await accrete('/scripts', { name, source: written.source, check: { args: [], files: { 'diff.patch': SAMPLE }, stdout: EXPECTED } });
const receipt = kept.body.receipt;
check('first keep ran in the container', receipt.kept === 'new' && receipt.containerSeconds > 0, `${receipt.containerSeconds} container-seconds`);
check('source, bundle and isolate all match the expected output', receipt.checks.sourceMatchesExpected && receipt.checks.bundleMatchesExpected && receipt.checks.isolateMatchesExpected);

const again = await accrete('/scripts', { name, source: written.source, check: { args: [], files: { 'diff.patch': SAMPLE }, stdout: EXPECTED } });
check('sending the same source again keeps it without a container', again.body.receipt.kept === 'already-kept' && again.body.receipt.containerSeconds === 0);

const runs = [];
for (let index = 0; index < REPEATS; index += 1) {
  const run = await accrete('/scripts/run', { name, input: { args: [], files: { 'diff.patch': SECOND } } });
  runs.push({ placement: run.body.placement, containerSeconds: run.body.containerSeconds, serverMs: run.body.ms, clientMs: run.clientMs, stdout: run.body.output.stdout });
}
check('every repeat ran from the registry', runs.every((run) => run.placement === 'built-tool' && run.containerSeconds === 0), runs.map((run) => `${run.serverMs} ms`).join(', '));
check('repeat output is correct on new input', runs.every((run) => run.stdout === SECOND_EXPECTED));

const bad = await fetch(`${ACCRETE_URL}/scripts`, {
  method: 'POST',
  headers: { authorization: `Bearer ${ACCRETE_TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ name: `${name}-wrong`, source: written.source, check: { args: [], files: { 'diff.patch': SAMPLE }, stdout: 'wrong\n' } }),
}).then((response) => response.json());
check('a script that does not match its expected output is refused', typeof bad.error === 'string' && bad.error.includes('does not produce the expected output'));

const network = await fetch(`${ACCRETE_URL}/scripts`, {
  method: 'POST',
  headers: { authorization: `Bearer ${ACCRETE_TOKEN}`, 'content-type': 'application/json' },
  body: JSON.stringify({ name: `${name}-net`, source: "export const run = async () => { const r = await fetch('https://example.com'); return { stdout: String(r.status) + '\\n', files: {} }; };\n", check: { args: [], files: {}, stdout: '200\n' } }),
}).then((response) => response.json());
check('a kept script cannot reach the network from the isolate', typeof network.error === 'string', network.error?.slice(0, 120));

const sorted = runs.map((run) => run.serverMs).sort((a, b) => a - b);
const sealed = {
  kind: 'accrete-scripts-proof',
  at: new Date().toISOString(),
  accrete: ACCRETE_URL,
  model: MODEL,
  task: TASK,
  script: { name, source: written.source, sourceSha256: createHash('sha256').update(written.source).digest('hex'), modelMs: written.ms, usage: written.usage },
  keep: receipt,
  keepAgain: again.body.receipt,
  repeats: runs,
  summary: {
    firstKeepContainerSeconds: receipt.containerSeconds,
    firstKeepMs: receipt.ms,
    repeatMedianMs: sorted[Math.floor(sorted.length / 2)],
    repeatContainerSeconds: runs.reduce((sum, run) => sum + run.containerSeconds, 0),
    repeatModelTokens: 0,
  },
  checks,
};
const body = JSON.stringify(sealed, null, 2);
mkdirSync('bench/scripts', { recursive: true });
writeFileSync(OUT, JSON.stringify({ ...sealed, sha256: createHash('sha256').update(body).digest('hex') }, null, 2) + '\n');
const failed = checks.filter((entry) => !entry.pass).length;
console.log(failed === 0 ? `SCRIPTS PROOF PASS: ${checks.length} checks · ${OUT}` : `SCRIPTS PROOF FAIL: ${failed} of ${checks.length}`);
process.exit(failed === 0 ? 0 : 1);
