import json5Recipe from '../recipes/json5.json';
import markedRecipe from '../recipes/marked.json';
import tscRecipe from '../recipes/tsc.json';
import yamlRecipe from '../recipes/yaml2json.json';
import status from '../status.json';
import { isRecipe, type Recipe } from './recipe';
import { forgetTools, listTools, putRecipe } from './tools';
import type { Env, Step } from './types';
import { selfSource } from './self-source';

const RECIPES: readonly unknown[] = [markedRecipe, yamlRecipe, json5Recipe, tscRecipe];

const recipes = (): readonly Recipe[] => RECIPES.filter(isRecipe);

const DEMO_TOOLS = ['json5', 'tsc'];

const COLD_TASK: { readonly seed: Readonly<Record<string, string>>; readonly steps: readonly Step[] } = {
  seed: { 'app.json5': "{\n  // accrete demo\n  name: 'accrete',\n  sizes: [1, 2, 3,],\n}\n" },
  steps: [{ op: 'tool', name: 'json5', args: ['-s', '2', 'app.json5'], inputs: ['app.json5'], stdoutTo: 'app.json' }],
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
  if (!local) return forbidden();
  if (request.method === 'POST' && pathname === '/api/reset') {
    await ensureRecipes(env);
    return Response.json({ removed: await forgetTools(env, DEMO_TOOLS) });
  }
  if (request.method === 'POST' && pathname === '/api/run/cold') {
    await ensureRecipes(env);
    return Response.json(await workspace(env, `demo-cold-${Date.now()}`).runTask(COLD_TASK.seed, COLD_TASK.steps));
  }
  if (request.method === 'POST' && pathname === '/api/run/self') {
    await ensureRecipes(env);
    return Response.json(await workspace(env, `demo-self-${Date.now()}`).runTask(selfSource, SELF_STEPS));
  }
  return Response.json({ error: 'not found' }, { status: 404 });
};
