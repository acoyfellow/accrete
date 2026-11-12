import * as Domain from '@alchemy.run/domain';
import * as DomainFoldkit from '@alchemy.run/domain/Foldkit';
import { expect, it } from '@effect/vitest';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { FetchHttpClient } from 'effect/http';
import { ToolApi } from '../src/api';
import { Message, type Model, update } from '../src/build-button';

const BASE: string | undefined = import.meta.env.VITE_TOOLS_URL;

const Live = Layer.merge(
  ToolApi.layerClient.pipe(Layer.provide(Domain.protocolHttp(`${BASE ?? 'http://unused'}/api`)), Layer.provide(FetchHttpClient.layer)),
  Layer.succeed(DomainFoldkit.CommandHeaders, { get: () => Effect.succeed({}) }),
);

const click = (page: Model) =>
  Effect.gen(function* () {
    const step = update(page, Message.ClickedBuild());
    const [send] = step.commands ?? [];
    if (send === undefined) return 'no command';
    const reply = yield* send.effect;
    return update(step.model, reply).model.answer;
  });

it.live.skipIf(BASE === undefined)('two agents click build on the deployed tool: one builds, one waits', () =>
  Effect.gen(function* () {
    const tool = `sass-ui-${Date.now()}`;
    const fresh = (agent: string): Model => ({ tool, agent, answer: '', commandIds: { session: agent, sent: 0 } });
    const answers = yield* Effect.all([click(fresh('agent-a')), click(fresh('agent-b'))], { concurrency: 'unbounded' });
    console.log(JSON.stringify({ url: BASE, answers }));
    expect([...answers].sort()).toEqual(['AlreadyBuilding', 'Building']);
  }).pipe(Effect.provide(Live)),
);
