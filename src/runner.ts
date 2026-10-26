import type { Env, ToolInput, ToolOutput } from './types';

const isRecordOfStrings = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null && Object.values(value).every((entry) => typeof entry === 'string');

const isToolOutput = (value: unknown): value is ToolOutput =>
  typeof value === 'object' &&
  value !== null &&
  'stdout' in value &&
  typeof value.stdout === 'string' &&
  'files' in value &&
  isRecordOfStrings(value.files);

const hostModule = `import { run } from "./tool.js";
export default {
  async fetch(request) {
    try {
      const input = await request.json();
      const output = await run(input);
      return Response.json({ ok: true, output });
    } catch (error) {
      return Response.json({ ok: false, error: String(error && error.message ? error.message : error) });
    }
  }
};`;

export const runInIsolate = async (env: Env, hash: string, code: string, input: ToolInput): Promise<ToolOutput> => {
  const worker = env.LOADER.get(hash, () => ({
    compatibilityDate: '2026-09-30',
    mainModule: 'host.js',
    modules: { 'host.js': hostModule, 'tool.js': code },
    globalOutbound: null,
    env: {},
  }));
  const response = await worker.getEntrypoint().fetch(
    new Request('https://tool.accrete/', { method: 'POST', body: JSON.stringify(input) }),
  );
  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null || !('ok' in body)) throw new Error('tool returned no result');
  if (body.ok !== true) throw new Error('error' in body ? String(body.error) : 'tool failed');
  const output = 'output' in body ? body.output : undefined;
  if (!isToolOutput(output)) throw new Error('tool output has the wrong shape');
  return output;
};
