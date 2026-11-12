import { expect, test } from '@effect/vitest';
import { Command, given, message, model, story } from 'foldkit/story';
import { AlreadyBuilding } from '../../../src/domain/tool';
import { Message, type Model, update } from '../src/build-button';
import { Tools } from '../src/web';

const page: Model = { tool: 'sass', agent: 'agent-b', answer: '', commandIds: { session: 's', sent: 0 } };

test('clicking build while someone else builds shows AlreadyBuilding', () =>
  story(
    update,
    given(page),
    message(Message.ClickedBuild()),
    model((m) => expect(m.answer).toBe('asking…')),
    Command.resolve(
      Tools.RequestBuild,
      Tools.Message.FailedRequestBuild({
        commandId: 's:0',
        failure: { _tag: 'Rejected', rejection: new AlreadyBuilding({ by: 'agent-a' }) },
      }),
    ),
    model((m) => expect(m.answer).toBe('AlreadyBuilding')),
  ));
