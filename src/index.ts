import { isRecipe } from './recipe';
import { buildTool, forgetTools, listTools, putRecipe, registerTool } from './tools';
import { routeDemo } from './demo';
import { isScript, isToolInput, keepScript, runScript } from './scripts';
import { getSnapshot, isSnapshotUpload, putSnapshot } from './snapshots';
import type { Env, Step } from './types';
export { Workspace } from './workspace';
export { Registry } from './registry';
export { Builder } from './builder';

type TaskRequest = {
  readonly workspace: string;
  readonly seed: Readonly<Record<string, string>>;
  readonly steps: readonly Step[];
};

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isStringRecord = (value: unknown): value is Record<string, string> =>
  isObject(value) && Object.values(value).every((entry) => typeof entry === 'string');

type Registration = Parameters<typeof registerTool>[1];

const isRegistration = (value: unknown): value is Registration =>
  isObject(value) &&
  typeof value.name === 'string' &&
  typeof value.version === 'string' &&
  typeof value.code === 'string' &&
  isObject(value.check) &&
  isStringArray(value.check.args) &&
  isStringRecord(value.check.files) &&
  typeof value.check.stdout === 'string';

const isStep = (value: unknown): value is Step => {
  if (!isObject(value) || typeof value.op !== 'string') return false;
  switch (value.op) {
    case 'read':
      return typeof value.path === 'string';
    case 'write':
      return typeof value.path === 'string' && typeof value.content === 'string';
    case 'edit':
      return typeof value.path === 'string' && typeof value.find === 'string' && typeof value.replace === 'string';
    case 'tool':
      return (
        typeof value.name === 'string' &&
        isStringArray(value.args) &&
        isStringArray(value.inputs) &&
        (value.stdoutTo === undefined || typeof value.stdoutTo === 'string')
      );
    default:
      return false;
  }
};

const isTaskRequest = (value: unknown): value is TaskRequest =>
  isObject(value) &&
  typeof value.workspace === 'string' &&
  value.workspace.length > 0 &&
  isStringRecord(value.seed) &&
  Array.isArray(value.steps) &&
  value.steps.every(isStep);

const digestBytes = async (text: string): Promise<Uint8Array> =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

const equalSecret = async (actual: string, expected: string): Promise<boolean> => {
  const [a, b] = await Promise.all([digestBytes(actual), digestBytes(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
};

const authorized = async (request: Request, env: Env): Promise<boolean> => {
  if (env.ACCRETE_TOKEN.length === 0) return false;
  const header = request.headers.get('authorization');
  if (header === null) return false;
  return equalSecret(header, `Bearer ${env.ACCRETE_TOKEN}`);
};

const BAD_JSON = Symbol('bad-json');

const readJson = async (request: Request): Promise<unknown> => {
  try {
    return await request.json();
  } catch {
    return BAD_JSON;
  }
};

const badJson = (): Response => Response.json({ error: 'bad json' }, { status: 400 });

const failure = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const route = async (request: Request, env: Env): Promise<Response> => {
  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/tools') return Response.json(await listTools(env));
  if (request.method === 'POST' && pathname === '/tools') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isRegistration(body)) return Response.json({ error: 'bad registration' }, { status: 400 });
    return Response.json(await registerTool(env, body));
  }
  if (request.method === 'PUT' && pathname === '/recipes') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isRecipe(body)) return Response.json({ error: 'bad recipe' }, { status: 400 });
    await putRecipe(env, body);
    return Response.json({ ok: true, name: body.name });
  }
  if (request.method === 'POST' && pathname === '/build') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isRecipe(body)) return Response.json({ error: 'bad recipe' }, { status: 400 });
    return Response.json(await buildTool(env, body));
  }
  if (request.method === 'POST' && pathname === '/forget') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isObject(body) || !isStringArray(body.names)) {
      return Response.json({ error: 'bad names' }, { status: 400 });
    }
    return Response.json({ removed: await forgetTools(env, body.names) });
  }
  if (request.method === 'POST' && pathname === '/scripts') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isScript(body)) return Response.json({ error: 'bad script' }, { status: 400 });
    return Response.json(await keepScript(env, body));
  }
  if (request.method === 'POST' && pathname === '/scripts/run') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isObject(body) || typeof body.name !== 'string' || !isToolInput(body.input)) return Response.json({ error: 'bad run' }, { status: 400 });
    return Response.json(await runScript(env, body.name, body.input));
  }
  if (request.method === 'POST' && pathname === '/snapshots') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isSnapshotUpload(body)) return Response.json({ error: 'bad snapshot' }, { status: 400 });
    const stored = await putSnapshot(env, body);
    return Response.json({ key: stored.key, snapshotSha: stored.snapshotSha, bytes: stored.bytes });
  }
  if (request.method === 'GET' && pathname.startsWith('/snapshots/')) {
    const stored = await getSnapshot(env, pathname.slice('/snapshots/'.length));
    if (stored === null) return Response.json({ error: 'no such snapshot' }, { status: 404 });
    return Response.json(stored);
  }
  if (request.method === 'POST' && pathname === '/task') {
    const body = await readJson(request);
    if (body === BAD_JSON) return badJson();
    if (!isTaskRequest(body)) return Response.json({ error: 'bad task' }, { status: 400 });
    const workspace = env.WORKSPACE.get(env.WORKSPACE.idFromName(body.workspace));
    return Response.json(await workspace.runTask(body.seed, body.steps));
  }
  return Response.json({ error: 'not found' }, { status: 404 });
};

const isLocal = (request: Request): boolean => {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      try {
        return await routeDemo(request, env, isLocal(request));
      } catch (cause) {
        return Response.json({ error: failure(cause) }, { status: 500 });
      }
    }
    if (!(await authorized(request, env))) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      return await route(request, env);
    } catch (cause) {
      return Response.json({ error: failure(cause) }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
