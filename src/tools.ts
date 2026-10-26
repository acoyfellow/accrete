import { runInIsolate } from './runner';
import type { Env, ToolCheck, ToolInput, ToolOutput, ToolRecord } from './types';

const registry = (env: Env) => env.REGISTRY.get(env.REGISTRY.idFromName('global'));

const bundleKey = (hash: string): string => `tools/${hash}.js`;

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

export const runTool = async (env: Env, name: string, input: ToolInput): Promise<{ output: ToolOutput; record: ToolRecord }> => {
  const record = await registry(env).latest(name);
  if (record === null) throw new Error(`tool ${name} is not in the registry`);
  if (record.kind !== 'esm') throw new Error(`tool ${name} is ${record.kind}; slice 1 runs esm only`);
  const output = await runInIsolate(env, record.hash, await loadBundle(env, record.hash), input);
  return { output, record };
};

export type Registration = {
  readonly name: string;
  readonly version: string;
  readonly code: string;
  readonly check: ToolCheck;
};

export const registerTool = async (env: Env, registration: Registration): Promise<ToolRecord> => {
  const hash = await sha256(registration.code);
  const output = await runInIsolate(env, hash, registration.code, { args: registration.check.args, files: registration.check.files });
  if (output.stdout !== registration.check.stdout) {
    throw new Error(`check failed for ${registration.name}: isolate output does not match native output`);
  }
  await env.TOOLS.put(bundleKey(hash), registration.code);
  const record: ToolRecord = {
    name: registration.name,
    version: registration.version,
    hash,
    kind: 'esm',
    check: registration.check,
    registeredAt: new Date().toISOString(),
  };
  await registry(env).add(record);
  return record;
};

export const listTools = (env: Env): Promise<ToolRecord[]> => registry(env).list();
