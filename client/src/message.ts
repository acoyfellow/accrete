import * as Schema from "effect/Schema";
import { defineMessageUnion } from "foldkit/message";
import { Action, RunKind, Status, TaskResult, Tool } from "./model";

export const Message = defineMessageUnion({
  LoadedStatus: { status: Status, local: Schema.Boolean },
  FailedStatus: { reason: Schema.String },
  LoadedTools: { tools: Schema.Array(Tool) },
  FailedTools: { reason: Schema.String },
  ClickedRetry: {},
  ClickedReset: {},
  ClickedRun: { kind: RunKind },
  DidReset: {},
  Finished: { kind: RunKind, result: TaskResult },
  FailedAction: { action: Action, reason: Schema.String },
});

export type Message = typeof Message.Type;
