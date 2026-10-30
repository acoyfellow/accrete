import json5Recipe from '../recipes/json5.json';
import markedRecipe from '../recipes/marked.json';
import tscRecipe from '../recipes/tsc.json';
import yamlRecipe from '../recipes/yaml2json.json';
import status from '../status.json';
import { isRecipe, type Recipe } from './recipe';
import { forgetTools, listTools, putRecipe, tamperBundle } from './tools';
import { keepScript } from './scripts';
import { scriptNumbers } from '../client/src/numbers';
import type { Env, Step } from './types';
import { selfSource } from './self-source';

const RECIPES: readonly unknown[] = [markedRecipe, yamlRecipe, json5Recipe, tscRecipe];

const recipes = (): readonly Recipe[] => RECIPES.filter(isRecipe);

const DEMO_TOOLS = ['json5', 'tsc'];

const COLD_TASK: { readonly seed: Readonly<Record<string, string>>; readonly steps: readonly Step[] } = {
  seed: { 'app.json5': "{\n  // accrete demo\n  name: 'accrete',\n  sizes: [1, 2, 3,],\n}\n" },
  steps: [{ op: 'tool', name: 'json5', args: ['-s', '2', 'app.json5'], inputs: ['app.json5'], stdoutTo: 'app.json' }],
};

const DEMO_DIFF = [
  'diff --git a/src/cart.ts b/src/cart.ts',
  '--- a/src/cart.ts',
  '+++ b/src/cart.ts',
  '@@ -4,3 +4,5 @@',
  ' export const total = (items: Item[]) =>',
  '-  items.reduce((sum, item) => sum + item.price, 0);',
  '+  items.reduce((sum, item) => sum + item.price * item.quantity, 0);',
  '+',
  '+export const isEmpty = (items: Item[]) => items.length === 0;',
  'diff --git a/src/cart.test.ts b/src/cart.test.ts',
  '--- a/src/cart.test.ts',
  '+++ b/src/cart.test.ts',
  '@@ -1,2 +1,4 @@',
  "+test('quantity counts', () => expect(total([{ price: 2, quantity: 3 }])).toBe(6));",
  "+test('empty cart', () => expect(isEmpty([])).toBe(true));",
  '',
].join('\n');

const SCRIPT_TASK: { readonly seed: Readonly<Record<string, string>>; readonly steps: readonly Step[] } = {
  seed: { 'diff.patch': DEMO_DIFF },
  steps: [{ op: 'tool', name: scriptNumbers.name, args: [], inputs: ['diff.patch'], stdoutTo: 'checklist.md' }],
};

const KEPT_SCRIPT = {
  name: scriptNumbers.name,
  source: scriptNumbers.source,
  check: { args: [], files: { 'diff.patch': DEMO_DIFF }, stdout: '- [ ] src/cart.ts (+3 -1)\n- [ ] src/cart.test.ts (+2 -0)\n2 files, +5 -1\n' },
};

const SELF_STEPS: readonly Step[] = [
  { op: 'tool', name: 'tsc', args: ['-p', 'tsconfig.json'], inputs: Object.keys(selfSource), stdoutTo: 'reports/tsc.txt' },
];

const workspace = (env: Env, name: string) => env.WORKSPACE.get(env.WORKSPACE.idFromName(name));

const forbidden = (): Response => Response.json({ error: 'this action runs only in local dev' }, { status: 403 });

const ensureRecipes = async (env: Env): Promise<void> => {
  for (const recipe of recipes()) await putRecipe(env, recipe);
};

export const routeDemo = async (request: Request, env: Env, local: boolean): Promise<Response> => {
  const { pathname } = new URL(request.url);
  if (request.method === 'GET' && pathname === '/api/status') return Response.json({ status, local });
  if (request.method === 'GET' && pathname === '/api/tools') return Response.json(await listTools(env));
  if (request.method === 'POST' && pathname === '/api/script/run') {
    return Response.json(await workspace(env, `demo-script-${crypto.randomUUID()}`).runTask(SCRIPT_TASK.seed, SCRIPT_TASK.steps));
  }
  if (request.method === 'POST' && pathname === '/api/script/keep') {
    if (!local) return forbidden();
    return Response.json(await keepScript(env, KEPT_SCRIPT));
  }
  if (request.method === 'POST' && pathname === '/api/run/cold') {
    await ensureRecipes(env);
    return Response.json(await workspace(env, `demo-cold-${crypto.randomUUID()}`).runTask(COLD_TASK.seed, COLD_TASK.steps));
  }
  if (request.method === 'POST' && pathname === '/api/run/self') {
    await ensureRecipes(env);
    return Response.json(await workspace(env, `demo-self-${crypto.randomUUID()}`).runTask(selfSource, SELF_STEPS));
  }
  if (!local) return forbidden();
  if (request.method === 'POST' && pathname === '/api/reset') {
    await ensureRecipes(env);
    return Response.json({ removed: await forgetTools(env, DEMO_TOOLS) });
  }
  if (request.method === 'POST' && pathname === '/api/test/tamper') {
    const body: unknown = await request.json();
    if (typeof body !== 'object' || body === null || !('name' in body) || typeof body.name !== 'string') return Response.json({ error: 'bad name' }, { status: 400 });
    return Response.json({ hash: await tamperBundle(env, body.name) });
  }
  return Response.json({ error: 'not found' }, { status: 404 });
};
