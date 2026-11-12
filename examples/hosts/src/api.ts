import * as Domain from '@alchemy.run/domain';
import { Accrete } from '../../../src/domain/tool';

export class ToolApi extends Domain.Api('ToolApi', {
  model: Accrete,
  commands: [
    'RequestBuild',
    'RecordBuilt',
    'RecordFailed',
    'Register',
    'Forget',
  ],
}) {}
