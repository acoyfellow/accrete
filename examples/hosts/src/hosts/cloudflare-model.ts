import * as DomainCloudflare from '@alchemy.run/domain/Cloudflare';
import { hostAccrete } from '../host';

export default hostAccrete(DomainCloudflare.layerDurableObjects());
