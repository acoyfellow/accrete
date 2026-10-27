import { isBuildResult, isRecipe, type BuildResult, type Recipe } from './recipe';
import { runInIsolate } from './runner';
import type { Env, Placement, ToolCheck, ToolInput, ToolKind, ToolOutput, ToolRecord } from './types';

const registry = (env: Env) => env.REGISTRY.get(env.REGISTRY.idFromName('global'));

const bundleKey = (hash: string): string => `tools/${hash}.js`;

const recipeKey = (name: string): string => `recipes/${name}.json`;

export const sha256 = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const loadBundle = async (env: Env, hash: string): Promise<string> => {
  const object = await env.TOOLS.get(bundleKey(hash));
  if (object === null) throw new Error(`bundle ${hash} is missing`);
  const code = await object.text();
  if ((await sha256(code)) !== hash) throw new Error(`bundle ${hash} does not match its hash`);
  return code;
};

export type BuildReceipt = {
  readonly name: string;
  readonly hash: string;
  readonly bytes: number;
  readonly nativeMatchesBuilt: boolean;
  readonly isolateMatchesNative: boolean;
  readonly buildSeconds: number;
  readonly containerSeconds: number;
};

export type ToolRun = {
  readonly output: ToolOutput;
  readonly record: ToolRecord;
  readonly placement: Placement;
  readonly containerSeconds: number;
  readonly build?: BuildReceipt;
};

const builderStub = (env: Env) => env.BUILDER.getByName('builder');

const buildInContainer = async (env: Env, recipe: Recipe): Promise<{ result: BuildResult; containerSeconds: number }> => {
  const started = Date.now();
  const stub = builderStub(env);
  const body: unknown = await stub
    .fetch(new Request('http://builder/build', { method: 'POST', body: JSON.stringify(recipe) }))
    .then((response) => response.json())
    .finally(() => stub.shutdown());
  const containerSeconds = (Date.now() - started) / 1000;
  if (typeof body !== 'object' || body === null || !('ok' in body)) throw new Error('builder returned no result');
  if (body.ok !== true) throw new Error(`builder failed: ${'error' in body ? String(body.error) : 'unknown'}`);
  const result = 'result' in body ? body.result : undefined;
  if (!isBuildResult(result)) throw new Error('builder result has the wrong shape');
  return { result, containerSeconds };
};

const register = async (env: Env, name: string, version: string, code: string, check: ToolCheck, kind: ToolKind = 'esm'): Promise<ToolRecord> => {
  const hash = await sha256(code);
  const output = await runInIsolate(env, hash, code, { args: check.args, files: check.files }, kind === 'cli');
  if (output.stdout !== check.stdout) {
    throw new Error(`check failed for ${name}: isolate output does not match native output`);
  }
  await env.TOOLS.put(bundleKey(hash), code);
  const record: ToolRecord = { name, version, hash, kind, check, registeredAt: new Date().toISOString() };
  await registry(env).add(record);
  return record;
};

const loadRecipe = async (env: Env, name: string): Promise<Recipe | null> => {
  const object = await env.TOOLS.get(recipeKey(name));
  if (object === null) return null;
  const value: unknown = await object.json();
  if (!isRecipe(value)) throw new Error(`recipe ${name} is malformed`);
  return value;
};

export const buildTool = async (env: Env, recipe: Recipe): Promise<{ record: ToolRecord; build: BuildReceipt }> => {
  const { result, containerSeconds } = await buildInContainer(env, recipe);
  if (!result.match) {
    throw new Error(`built ${recipe.name} does not match native output: native=${JSON.stringify(result.nativeStdout.slice(0, 300))} built=${JSON.stringify(result.builtStdout.slice(0, 300))}`);
  }
  const version = Object.entries(result.versions).map(([name, value]) => `${name}@${value}`).join('+');
  const record = await register(env, recipe.name, version, result.code, { args: recipe.check.args, files: recipe.check.files, stdout: result.nativeStdout }, recipe.cli === undefined ? 'esm' : 'cli');
  return {
    record,
    build: {
      name: recipe.name,
      hash: record.hash,
      bytes: result.code.length,
      nativeMatchesBuilt: result.match,
      isolateMatchesNative: true,
      buildSeconds: result.buildSeconds,
      containerSeconds,
    },
  };
};

export const runTool = async (env: Env, name: string, input: ToolInput): Promise<ToolRun> => {
  const existing = await registry(env).latest(name);
  if (existing !== null) {
    if (existing.kind !== 'esm' && existing.kind !== 'cli') throw new Error(`tool ${name} is ${existing.kind}; only esm and cli tools run in isolates`);
    const output = await runInIsolate(env, existing.hash, await loadBundle(env, existing.hash), input, existing.kind === 'cli');
    return { output, record: existing, placement: 'built-tool', containerSeconds: 0 };
  }
  const recipe = await loadRecipe(env, name);
  if (recipe === null) throw new Error(`tool ${name} is not in the registry and has no recipe`);
  const { record, build } = await buildTool(env, recipe);
  const output = await runInIsolate(env, record.hash, await loadBundle(env, record.hash), input, record.kind === 'cli');
  return { output, record, placement: 'container', containerSeconds: build.containerSeconds, build };
};

export const putRecipe = async (env: Env, recipe: Recipe): Promise<void> => {
  await env.TOOLS.put(recipeKey(recipe.name), JSON.stringify(recipe));
};

export const registerTool = async (
  env: Env,
  registration: { readonly name: string; readonly version: string; readonly code: string; readonly check: ToolCheck },
): Promise<ToolRecord> => register(env, registration.name, registration.version, registration.code, registration.check);

export const listTools = (env: Env): Promise<ToolRecord[]> => registry(env).list();

export const forgetTools = (env: Env, names: readonly string[]): Promise<number> => registry(env).forget(names);
