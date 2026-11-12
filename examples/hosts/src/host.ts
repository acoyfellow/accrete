import * as Layer from 'effect/Layer';
import { Accrete } from '../../../src/domain/tool';

export const hostAccrete = <A, E, R>(platform: Layer.Layer<A, E, R>) =>
  Accrete.layer(Layer.empty).pipe(Layer.provide(platform));
