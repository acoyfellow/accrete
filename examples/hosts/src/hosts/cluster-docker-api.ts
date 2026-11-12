import * as Docker from '@alchemy.run/docker';
import * as Cluster from '@alchemy.run/effect-cluster';
import * as Effect from 'effect/Effect';
import { toolFetch } from '../http';
import AccreteLive, { Database } from './cluster-docker';

export const PORT = 8090;

export default class ToolService extends Docker.Service<ToolService>()(
  'ToolService',
  Effect.gen(function* () {
    const database = yield* Cluster.Database.Database;
    return {
      main: import.meta.url,
      port: 3000,
      ports: [{ external: PORT, internal: 3000 }],
      networks: database.network?.kind === 'docker' ? [{ name: database.network.name }] : [],
    };
  }).pipe(Effect.provide(Database)),
  Effect.gen(function* () {
    return { fetch: yield* toolFetch };
  }).pipe(Effect.provide(AccreteLive)),
) {}
