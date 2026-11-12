import { Command, type Update } from 'foldkit';
import { defineMessageUnion } from 'foldkit/message';
import { modifyFields } from 'foldkit/struct';
import * as Schema from 'effect/Schema';
import * as DomainFoldkit from '@alchemy.run/domain/Foldkit';
import { ToolApi } from './api';
import type { RequestBuild } from '../../../src/domain/tool';
import { Tools } from './web';

export const Model = Schema.Struct({
  tool: Schema.String,
  agent: Schema.String,
  answer: Schema.String,
  commandIds: DomainFoldkit.CommandIds,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ClickedBuild: {},
  ReceivedAnswer: { result: Tools.Message },
});
export type Message = typeof Message.Type;

type Client = typeof ToolApi.Client.Identifier;

type Return = Update.Return<Model, Message, Client>;

const askToBuild = (model: Model): Return => {
  const next = DomainFoldkit.next(model.commandIds);
  const { commandId, commandIds } = next;
  const target = model.tool;
  const input = { by: model.agent, at: Date.now() };
  const send = Tools.RequestBuild({ target, input, commandId });
  return {
    model: modifyFields(model, {
      commandIds: () => commandIds,
      answer: () => 'asking…',
    }),
    commands: [
      Command.mapMessage(send, (result) =>
        Message.ReceivedAnswer({ result }),
      ),
    ],
  };
};

const answered = (model: Model, answer: string): Return => ({
  model: modifyFields(model, { answer: () => answer }),
  commands: [],
});

type Refusal = DomainFoldkit.Failure<typeof RequestBuild>;

const refusal = (model: Model, failure: Refusal) =>
  failure._tag === 'Rejected'
    ? answered(model, failure.rejection._tag)
    : answered(model, failure._tag);

const unchanged = (model: Model) => answered(model, model.answer);

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    ClickedBuild: () => askToBuild(model),
    ReceivedAnswer: ({ result }) =>
      Tools.Message.match(result, {
        SucceededRequestBuild: () => answered(model, 'Building'),
        FailedRequestBuild: ({ failure }) => refusal(model, failure),
        SucceededRecordBuilt: () => unchanged(model),
        FailedRecordBuilt: () => unchanged(model),
        SucceededRecordFailed: () => unchanged(model),
        FailedRecordFailed: () => unchanged(model),
        SucceededRegister: () => unchanged(model),
        FailedRegister: () => unchanged(model),
        SucceededForget: () => unchanged(model),
        FailedForget: () => unchanged(model),
      }),
  });
