import * as Cloudflare from '@alchemy.run/cloudflare';
import * as DomainCloudflare from '@alchemy.run/domain/Cloudflare';
import * as Alchemy from 'alchemy';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import ToolWorker from './src/hosts/cloudflare';

export default Alchemy.Stack(
  'AccreteCloudflare',
  { providers: Layer.mergeAll(Cloudflare.providers(), DomainCloudflare.providers()), state: Alchemy.localState() },
  Effect.gen(function* () {
    const worker = yield* ToolWorker;
    return { url: worker.url.as<string>() };
  }),
);
