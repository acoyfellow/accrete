import { isRecipe } from './recipe';
import { buildTool, forgetTools, listTools, putRecipe, registerTool } from './tools';
import { routeDemo } from './demo';
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

type Registration = Parameters<typeof registerTool>[1];

const isRegistration = (value: unknown): value is Registration =>
  isObject(value) &&
  typeof value.name === 'string' &&
  typeof value.version === 'string' &&
  typeof value.code === 'string' &&
  isObject(value.check) &&
  Array.isArray(value.check.args) &&
  isObject(value.check.files) &&
  typeof value.check.stdout === 'string';

const isStep = (value: unknown): value is Step =>
  isObject(value) && (value.op === 'read' || value.op === 'write' || value.op === 'edit' || value.op === 'tool');

const isTaskRequest = (value: unknown): value is TaskRequest =>
  isObject(value) &&
  typeof value.workspace === 'string' &&
  isObject(value.seed) &&
  Array.isArray(value.steps) &&
  value.steps.every(isStep);

const authorized = (request: Request, env: Env): boolean =>
  env.ACCRETE_TOKEN.length > 0 && request.headers.get('authorization') === `Bearer ${env.ACCRETE_TOKEN}`;

const failure = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const route = async (request: Request, env: Env): Promise<Response> => {
  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/tools') return Response.json(await listTools(env));
  if (request.method === 'POST' && pathname === '/tools') {
    const body: unknown = await request.json();
    if (!isRegistration(body)) return Response.json({ error: 'bad registration' }, { status: 400 });
    return Response.json(await registerTool(env, body));
  }
  if (request.method === 'PUT' && pathname === '/recipes') {
    const body: unknown = await request.json();
    if (!isRecipe(body)) return Response.json({ error: 'bad recipe' }, { status: 400 });
    await putRecipe(env, body);
    return Response.json({ ok: true, name: body.name });
  }
  if (request.method === 'POST' && pathname === '/build') {
    const body: unknown = await request.json();
    if (!isRecipe(body)) return Response.json({ error: 'bad recipe' }, { status: 400 });
    return Response.json(await buildTool(env, body));
  }
  if (request.method === 'POST' && pathname === '/forget') {
    const body: unknown = await request.json();
    if (!isObject(body) || !Array.isArray(body.names) || !body.names.every((name: unknown) => typeof name === 'string')) {
      return Response.json({ error: 'bad names' }, { status: 400 });
    }
    return Response.json({ removed: await forgetTools(env, body.names) });
  }
  if (request.method === 'POST' && pathname === '/task') {
    const body: unknown = await request.json();
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
    if (!authorized(request, env)) return Response.json({ error: 'unauthorized' }, { status: 401 });
    try {
      return await route(request, env);
    } catch (cause) {
      return Response.json({ error: failure(cause) }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
