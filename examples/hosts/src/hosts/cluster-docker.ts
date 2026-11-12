import * as DomainCluster from '@alchemy.run/domain/EffectCluster';
import * as ClusterDocker from '@alchemy.run/effect-cluster/Docker';
import * as Layer from 'effect/Layer';
import { hostAccrete } from '../host';

export const Database = ClusterDocker.Database('AccreteCluster');

export const Pool = ClusterDocker.SwarmPool('Runners', {
  replicas: 2,
}).pipe(Layer.provide(Database));

export default hostAccrete(
  DomainCluster.layerEntities({
    name: 'Accrete',
    main: import.meta.url,
    pool: Pool,
  }),
);
