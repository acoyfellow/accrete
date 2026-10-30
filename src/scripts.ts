import { runInIsolate } from './runner';
import { registerTool, runTool, sha256, type ToolRun } from './tools';
import type { Env, ToolCheck, ToolInput, ToolRecord } from './types';

export type Script = {
  readonly name: string;
  readonly source: string;
  readonly packages?: Readonly<Record<string, string>>;
  readonly check: ToolCheck;
};

export type ScriptBuild = {
  readonly code: string;
  readonly sourceStdout: string;
  readonly bundledStdout: string;
  readonly expectedStdout: string;
  readonly match: boolean;
  readonly buildSeconds: number;
};

export type KeepReceipt = {
  readonly name: string;
  readonly sourceHash: string;
  readonly hash: string;
  readonly bytes: number;
  readonly kept: 'new' | 'already-kept';
  readonly checks: { readonly sourceMatchesExpected: boolean; readonly bundleMatchesExpected: boolean; readonly isolateMatchesExpected: boolean };
  readonly containerSeconds: number;
  readonly ms: number;
};

const NAME = new RegExp('^[a-z][a-z0-9-]{1,47}$');

const MAX_SOURCE_BYTES = 200_000;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isStringRecord = (value: unknown): value is Record<string, string> => isObject(value) && Object.values(value).every((entry) => typeof entry === 'string');

export const isScript = (value: unknown): value is Script =>
  isObject(value) &&
  typeof value.name === 'string' &&
  NAME.test(value.name) &&
  typeof value.source === 'string' &&
  value.source.length <= MAX_SOURCE_BYTES &&
  (value.packages === undefined || isStringRecord(value.packages)) &&
  isObject(value.check) &&
  Array.isArray(value.check.args) &&
  value.check.args.every((entry: unknown) => typeof entry === 'string') &&
  isStringRecord(value.check.files) &&
  typeof value.check.stdout === 'string';

export const isToolInput = (value: unknown): value is ToolInput =>
  isObject(value) && Array.isArray(value.args) && value.args.every((entry: unknown) => typeof entry === 'string') && isStringRecord(value.files);

const isScriptBuild = (value: unknown): value is ScriptBuild =>
  isObject(value) &&
  typeof value.code === 'string' &&
  typeof value.sourceStdout === 'string' &&
  typeof value.bundledStdout === 'string' &&
  typeof value.match === 'boolean' &&
  typeof value.buildSeconds === 'number';

const versionOf = (sourceHash: string): string => `script@${sourceHash.slice(0, 16)}`;

const registry = (env: Env) => env.REGISTRY.get(env.REGISTRY.idFromName('global'));

const buildInContainer = async (env: Env, script: Script): Promise<{ build: ScriptBuild; containerSeconds: number }> => {
  const started = Date.now();
  const stub = env.BUILDER.getByName('builder');
  const body: unknown = await stub
    .fetch(new Request('http://builder/script', { method: 'POST', body: JSON.stringify(script) }))
    .then((response) => response.json())
    .finally(() => stub.shutdown());
  const containerSeconds = (Date.now() - started) / 1000;
  if (!isObject(body) || body.ok !== true) throw new Error(`builder failed: ${isObject(body) && 'error' in body ? String(body.error) : 'no result'}`);
  if (!isScriptBuild(body.result)) throw new Error('builder script result has the wrong shape');
  return { build: body.result, containerSeconds };
};

const mismatch = (script: Script, build: ScriptBuild): string =>
  `script ${script.name} does not produce the expected output: expected=${JSON.stringify(script.check.stdout.slice(0, 200))} source=${JSON.stringify(build.sourceStdout.slice(0, 200))} bundle=${JSON.stringify(build.bundledStdout.slice(0, 200))}`;

export const keepScript = async (env: Env, script: Script): Promise<{ record: ToolRecord; receipt: KeepReceipt }> => {
  const started = Date.now();
  const sourceHash = await sha256(script.source);
  const existing = await registry(env).latest(script.name);
  if (existing !== null && existing.version === versionOf(sourceHash)) {
    const output = await runInIsolate(env, existing.hash, await loadCode(env, existing.hash), { args: script.check.args, files: script.check.files });
    if (output.stdout !== script.check.stdout) throw new Error(`kept script ${script.name} no longer matches the expected output`);
    return {
      record: existing,
      receipt: {
        name: script.name,
        sourceHash,
        hash: existing.hash,
        bytes: 0,
        kept: 'already-kept',
        checks: { sourceMatchesExpected: true, bundleMatchesExpected: true, isolateMatchesExpected: true },
        containerSeconds: 0,
        ms: Date.now() - started,
      },
    };
  }
  const { build, containerSeconds } = await buildInContainer(env, script);
  if (!build.match) throw new Error(mismatch(script, build));
  const record = await registerTool(env, { name: script.name, version: versionOf(sourceHash), code: build.code, check: script.check });
  return {
    record,
    receipt: {
      name: script.name,
      sourceHash,
      hash: record.hash,
      bytes: build.code.length,
      kept: 'new',
      checks: { sourceMatchesExpected: build.sourceStdout === script.check.stdout, bundleMatchesExpected: build.bundledStdout === script.check.stdout, isolateMatchesExpected: true },
      containerSeconds,
      ms: Date.now() - started,
    },
  };
};

const loadCode = async (env: Env, hash: string): Promise<string> => {
  const object = await env.TOOLS.get(`tools/${hash}.js`);
  if (object === null) throw new Error(`bundle ${hash} is missing`);
  const code = await object.text();
  if ((await sha256(code)) !== hash) throw new Error(`bundle ${hash} does not match its hash`);
  return code;
};

export const runScript = async (env: Env, name: string, input: ToolInput): Promise<ToolRun & { readonly ms: number }> => {
  const started = Date.now();
  const record = await registry(env).latest(name);
  if (record === null || !record.version.startsWith('script@')) throw new Error(`no kept script named ${name}`);
  const run = await runTool(env, name, input);
  return { ...run, ms: Date.now() - started };
};
