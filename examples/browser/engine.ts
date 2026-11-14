import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import * as Context from 'effect/Context';
import { ToolApi } from '../hosts/src/api';
import World from '../hosts/src/hosts/in-memory';

export type Answer =
  | { readonly ok: true; readonly event: string; readonly version: number }
  | { readonly ok: false; readonly rejection: string; readonly detail: string };

type Client = Effect.Success<typeof ToolApi.clientInProcess>;

const EVENT_OF = {
  RequestBuild: 'BuildStarted',
  RecordBuilt: 'Built',
  RecordFailed: 'BuildFailed',
  Register: 'Registered',
  Forget: 'Forgotten',
} as const;

const detailOf = (rejection: object): string =>
  Object.entries(rejection)
    .filter(([key]) => key !== '_tag')
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(', ');

const answer = (ask: Ask, call: Effect.Effect<{ readonly version: number }, unknown>) =>
  call.pipe(
    Effect.map((receipt): Answer => ({ ok: true, event: EVENT_OF[ask], version: receipt.version })),
    Effect.catch((rejection) => {
      const tagged = rejection as { readonly _tag: string };
      return Effect.succeed<Answer>({ ok: false, rejection: tagged._tag, detail: detailOf(tagged) });
    }),
  );

const send = (client: Client, ask: Ask, tool: string, by: string): Effect.Effect<Answer> => {
  const at = Date.now();
  const hash = `h-${at.toString(36)}`;
  const checks = { nativeMatchesBundle: true, isolateMatchesNative: true };
  if (ask === 'RequestBuild') return answer(ask, client.RequestBuild(tool, { by, at }));
  if (ask === 'RecordBuilt') return answer(ask, client.RecordBuilt(tool, { by, hash, version: '1.0.0', ...checks }));
  if (ask === 'RecordFailed') return answer(ask, client.RecordFailed(tool, { by, reason: 'compile error' }));
  if (ask === 'Register') return answer(ask, client.Register(tool, { hash, version: '1.0.0', isolateMatchesExpected: true }));
  return answer(ask, client.Forget(tool, {}));
};

class Agents extends Context.Service<Agents, Client>()('Agents') {}

const AgentsLive = Layer.effect(Agents, ToolApi.clientInProcess).pipe(Layer.provideMerge(World));

export type Ask = keyof typeof EVENT_OF;

export const createWorld = () => {
  const runtime = ManagedRuntime.make(AgentsLive);
  const run = <A>(use: (client: Client) => Effect.Effect<A>) =>
    runtime.runPromise(Effect.flatMap(Agents, use));
  return {
    ask: (ask: Ask, tool: string, by: string) => run((client) => send(client, ask, tool, by)),
    race: (tool: string, agents: number) =>
      run((client) =>
        Effect.all(
          Array.from({ length: agents }, (_, n) => send(client, 'RequestBuild', tool, `agent-${n + 1}`)),
          { concurrency: 'unbounded' },
        ),
      ),
    dispose: () => runtime.dispose(),
  };
};
