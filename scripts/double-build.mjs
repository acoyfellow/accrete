import { build } from 'esbuild';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const FAKE_RUNNER = `export const runInIsolate = async () => ({ stdout: 'ok', files: {} });`;

const bundleTools = async () => {
  const dir = mkdtempSync(join(tmpdir(), 'accrete-race-'));
  const out = join(dir, 'tools.mjs');
  await build({
    stdin: { contents: "export * from './src/tools.ts'; export * as book from './src/domain/book.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: out,
    logLevel: 'silent',
    plugins: [
      {
        name: 'fake-runner',
        setup(b) {
          b.onResolve({ filter: /^\.\/runner$/ }, () => ({ path: 'runner', namespace: 'fake' }));
          b.onLoad({ filter: /^/, namespace: 'fake' }, () => ({ contents: FAKE_RUNNER, loader: 'js' }));
        },
      },
    ],
  });
  return import(pathToFileURL(out).href);
};

const fakeEnv = (book, buildMs, failFirst = false) => {
  const objects = new Map();
  const records = [];
  const states = new Map();
  const builds = { started: 0 };
  const recipe = { name: 'sass', packages: { sass: '1.0.0' }, entry: 'x', native: { bin: 'sass', args: [] }, check: { args: [], files: {} } };
  objects.set('recipes/sass.json', JSON.stringify(recipe));
  const latest = (name) => records.filter((r) => r.name === name).at(-1) ?? null;
  const store = {
    readState: (name) => states.get(name) ?? null,
    writeState: (name, state) => void states.set(name, state),
    latest,
    addRecord: (record) => {
      if (!records.some((r) => r.name === record.name && r.hash === record.hash)) records.push(record);
    },
    removeRecords: () => 0,
  };
  const registry = {
    latest: async (name) => latest(name),
    requestBuild: async (name, by) => book.requestBuild(store, name, by, Date.now()),
    recordBuilt: async (record, by, checks) => book.recordBuilt(store, record, by, checks, Date.now()),
    recordFailed: async (name, by, reason) => book.recordFailed(store, name, by, reason, Date.now()),
    register: async (record, matches) => book.register(store, record, matches, Date.now()),
  };
  return {
    builds,
    records,
    env: {
      REGISTRY: { idFromName: (name) => name, get: () => registry },
      TOOLS: {
        get: async (key) => (objects.has(key) ? { text: async () => objects.get(key), json: async () => JSON.parse(objects.get(key)) } : null),
        put: async (key, value) => void objects.set(key, value),
      },
      BUILDER: {
        getByName: () => ({
          fetch: async () => {
            builds.started += 1;
            const n = builds.started;
            await new Promise((resolve) => setTimeout(resolve, buildMs));
            if (failFirst && n === 1) return new Response(JSON.stringify({ ok: false, error: 'container exited 137' }));
            const result = { code: `bundle ${n}`, versions: { sass: '1.0.0' }, nativeStdout: 'ok', nativeExit: 0, nativeStderr: '', builtStdout: 'ok', match: true, buildSeconds: buildMs / 1000 };
            return new Response(JSON.stringify({ ok: true, result }));
          },
          shutdown: async () => {},
        }),
      },
    },
  };
};

const tools = await bundleTools();
const callers = Number(process.argv[2] ?? 2);
const input = { args: [], files: {} };

const crashed = fakeEnv(tools.book, 50, true);
const crashedFirst = await tools.runTool(crashed.env, 'sass', input).then(() => 'succeeded', (cause) => String(cause.message));
const retried = await tools.runTool(crashed.env, 'sass', input);
const crashRecovery = { firstCall: crashedFirst, retryPlacement: retried.placement, containerBuilds: crashed.builds.started, pass: retried.placement === 'container' && crashed.builds.started === 2 };

const { env, builds, records } = fakeEnv(tools.book, 200);
const runs = await Promise.all(Array.from({ length: callers }, () => tools.runTool(env, 'sass', input)));
const after = await tools.runTool(env, 'sass', input);

const receipt = {
  callers,
  containerBuilds: builds.started,
  registeredVersions: records.length,
  placements: runs.map((run) => run.placement),
  laterCallPlacement: after.placement,
  verdict: builds.started === 1 ? 'no double build' : 'double build',
  crashRecovery,
};
console.log(JSON.stringify(receipt, null, 2));
process.exit(receipt.verdict === 'no double build' && crashRecovery.pass ? 0 : 1);
