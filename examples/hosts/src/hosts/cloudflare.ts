import * as Cloudflare from '@alchemy.run/cloudflare';
import * as Effect from 'effect/Effect';
import { HttpServerRequest } from 'effect/http/HttpServerRequest';
import { ToolApi } from '../api';
import { toolFetch } from '../http';
import AccreteLive from './cloudflare-model';

export default class ToolWorker extends Cloudflare.Worker<ToolWorker>()(
  'AccreteTools',
  { main: import.meta.url },
  Effect.gen(function* () {
    const api = yield* ToolApi;
    const http = yield* toolFetch;
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest;
        const path = new URL(request.url, 'http://localhost').pathname;
        if (path.startsWith('/api')) return yield* api.fetch;
        return yield* http;
      }),
    };
  }).pipe(Effect.provide(AccreteLive)),
) {}
