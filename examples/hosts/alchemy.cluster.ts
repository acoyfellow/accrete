import * as Docker from '@alchemy.run/docker';
import * as Cluster from '@alchemy.run/effect-cluster';
import * as Alchemy from 'alchemy';
import * as Output from 'alchemy/Output';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import ToolService from './src/hosts/cluster-docker-api';

export default Alchemy.Stack(
  'AccreteCluster',
  { providers: Layer.mergeAll(Docker.providers(), Cluster.providers()), state: Alchemy.localState() },
  Effect.gen(function* () {
    const service = yield* ToolService;
    const url = service.ports.pipe(Output.map((ports) => `http://localhost:${ports[0]?.external ?? 'unpublished'}`));
    return { url };
  }),
);
