import { expect, it } from '@effect/vitest';
import * as Effect from 'effect/Effect';
import { ToolApi } from '../src/api';
import World from '../src/hosts/in-memory';

it.live('20 agents ask for sass at once: one build starts, 19 are told to wait', () =>
  Effect.gen(function* () {
    const client = yield* ToolApi.clientInProcess;
    const asks = Array.from({ length: 20 }, (_, n) =>
      client.RequestBuild('sass', { by: `agent-${n}`, at: 0 }).pipe(
        Effect.map(() => 'BuildStarted'),
        Effect.catch((rejection) => Effect.succeed(String((rejection as { _tag: string })._tag))),
      ),
    );
    const answers = yield* Effect.all(asks, { concurrency: 'unbounded' });
    const count = (tag: string) => answers.filter((answer) => answer === tag).length;
    console.log(JSON.stringify({ started: count('BuildStarted'), waiting: count('AlreadyBuilding') }));
    expect(count('BuildStarted')).toBe(1);
    expect(count('AlreadyBuilding')).toBe(19);
  }).pipe(Effect.scoped, Effect.provide(World)),
);
