import * as DomainHttp from '@alchemy.run/domain/Http';
import * as Http from 'alchemy/Http';
import * as HttpApiBuilder from 'effect/http-api/HttpApiBuilder';
import * as HttpRouter from 'effect/http/HttpRouter';
import * as Layer from 'effect/Layer';
import { ToolApi } from './api';

export const ToolHttp = DomainHttp.toHttpApi(ToolApi, { expose: ['RequestBuild', 'RecordBuilt', 'RecordFailed', 'Forget'] });

export const toolFetch = HttpRouter.toHttpEffect(
  HttpApiBuilder.layer(ToolHttp.api, { openapiPath: '/openapi.json' }).pipe(
    Layer.provide(ToolHttp.layer),
    Layer.provide(Http.Platform),
  ),
);
