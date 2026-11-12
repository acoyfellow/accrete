import { isBuildResult, isRecipe, type BuildResult, type Recipe } from './recipe';
import { type Decision, rejectionOf } from './domain/decide';
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

const BUILD_WAIT_POLL_MS = 500;

const rejectionMessage = (name: string, decision: Decision): string => {
  const rejected = rejectionOf(decision);
  return rejected === null ? '' : `tool ${name}: ${rejected.rejection} ${JSON.stringify(rejected.detail)}`;
};

const checkInIsolate = async (env: Env, name: string, version: string, code: string, check: ToolCheck, kind: ToolKind): Promise<{ record: ToolRecord; matches: boolean }> => {
  const hash = await sha256(code);
  const output = await runInIsolate(env, hash, code, { args: check.args, files: check.files }, kind === 'cli');
  const matches = output.stdout === check.stdout;
  if (matches) await env.TOOLS.put(bundleKey(hash), code);
  return { record: { name, version, hash, kind, check, registeredAt: new Date().toISOString() }, matches };
};

const register = async (env: Env, name: string, version: string, code: string, check: ToolCheck): Promise<ToolRecord> => {
  const { record, matches } = await checkInIsolate(env, name, version, code, check, 'esm');
  if (!matches) throw new Error(`check failed for ${name}: isolate output does not match native output`);
  const decision = await registry(env).register(record, matches);
  if (!decision.accepted) throw new Error(rejectionMessage(name, decision));
  return record;
};

const loadRecipe = async (env: Env, name: string): Promise<Recipe | null> => {
  const object = await env.TOOLS.get(recipeKey(name));
  if (object === null) return null;
  const value: unknown = await object.json();
  if (!isRecipe(value)) throw new Error(`recipe ${name} is malformed`);
  return value;
};

const buildClaimed = async (env: Env, recipe: Recipe, by: string): Promise<{ record: ToolRecord; build: BuildReceipt }> => {
  const { result, containerSeconds } = await buildInContainer(env, recipe);
  if (!result.match) {
    throw new Error(`built ${recipe.name} does not match native output: native=${JSON.stringify(result.nativeStdout.slice(0, 300))} built=${JSON.stringify(result.builtStdout.slice(0, 300))}`);
  }
  const version = Object.entries(result.versions).map(([name, value]) => `${name}@${value}`).join('+');
  const check = { args: recipe.check.args, files: recipe.check.files, stdout: result.nativeStdout };
  const { record, matches } = await checkInIsolate(env, recipe.name, version, result.code, check, recipe.cli === undefined ? 'esm' : 'cli');
  if (!matches) throw new Error(`check failed for ${recipe.name}: isolate output does not match native output`);
  const decision = await registry(env).recordBuilt(record, by, { nativeMatchesBundle: result.match, isolateMatchesNative: matches });
  if (!decision.accepted) throw new Error(rejectionMessage(recipe.name, decision));
  return {
    record,
    build: {
      name: recipe.name,
      hash: record.hash,
      bytes: result.code.length,
      nativeMatchesBuilt: result.match,
      isolateMatchesNative: matches,
      buildSeconds: result.buildSeconds,
      containerSeconds,
    },
  };
};

const buildOrRelease = async (env: Env, recipe: Recipe, by: string): Promise<{ record: ToolRecord; build: BuildReceipt }> => {
  try {
    return await buildClaimed(env, recipe, by);
  } catch (cause) {
    await registry(env).recordFailed(recipe.name, by, cause instanceof Error ? cause.message : String(cause));
    throw cause;
  }
};

export const buildTool = async (env: Env, recipe: Recipe): Promise<{ record: ToolRecord; build: BuildReceipt }> => {
  const by = crypto.randomUUID();
  const decision = await registry(env).requestBuild(recipe.name, by);
  if (!decision.accepted) throw new Error(rejectionMessage(recipe.name, decision));
  return buildOrRelease(env, recipe, by);
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const runRecord = async (env: Env, record: ToolRecord, input: ToolInput): Promise<ToolOutput> => {
  if (record.kind !== 'esm' && record.kind !== 'cli') throw new Error(`tool ${record.name} is ${record.kind}; only esm and cli tools run in isolates`);
  return runInIsolate(env, record.hash, await loadBundle(env, record.hash), input, record.kind === 'cli');
};

const fromRegistry = async (env: Env, name: string, input: ToolInput): Promise<ToolRun | null> => {
  const record = await registry(env).latest(name);
  return record === null ? null : { output: await runRecord(env, record, input), record, placement: 'built-tool', containerSeconds: 0 };
};

const buildAndRun = async (env: Env, recipe: Recipe, by: string, input: ToolInput): Promise<ToolRun> => {
  const { record, build } = await buildOrRelease(env, recipe, by);
  const output = await runRecord(env, record, input);
  return { output, record, placement: 'container', containerSeconds: build.containerSeconds, build };
};

const requireRecipe = async (env: Env, name: string): Promise<Recipe> => {
  const recipe = await loadRecipe(env, name);
  if (recipe === null) throw new Error(`tool ${name} is not in the registry and has no recipe`);
  return recipe;
};

const waitOrFail = async (name: string, decision: Decision) => {
  switch (rejectionOf(decision)?.rejection) {
    case 'AlreadyBuilding':
      return sleep(BUILD_WAIT_POLL_MS);
    case 'AlreadyBuilt':
      return;
    default:
      throw new Error(rejectionMessage(name, decision));
  }
};

export const runTool = async (
  env: Env,
  name: string,
  input: ToolInput,
): Promise<ToolRun> => {
  const by = crypto.randomUUID();
  for (;;) {
    const existing = await fromRegistry(env, name, input);
    if (existing !== null) return existing;

    const recipe = await requireRecipe(env, name);
    const decision = await registry(env).requestBuild(name, by);
    if (decision.accepted) return buildAndRun(env, recipe, by, input);

    await waitOrFail(name, decision);
  }
};

export const putRecipe = async (env: Env, recipe: Recipe): Promise<void> => {
  await env.TOOLS.put(recipeKey(recipe.name), JSON.stringify(recipe));
};

export const registerTool = async (
  env: Env,
  registration: { readonly name: string; readonly version: string; readonly code: string; readonly check: ToolCheck },
): Promise<ToolRecord> => register(env, registration.name, registration.version, registration.code, registration.check);

export const tamperBundle = async (env: Env, name: string): Promise<string> => {
  const record = await registry(env).latest(name);
  if (record === null) throw new Error(`tool ${name} is not registered`);
  const code = await loadBundle(env, record.hash);
  await env.TOOLS.put(bundleKey(record.hash), `${code}\nglobalThis.tampered = true;\n`);
  return record.hash;
};

export const listTools = (env: Env): Promise<ToolRecord[]> => registry(env).list();

export const forgetTools = (env: Env, names: readonly string[]): Promise<number> => registry(env).forget(names);
