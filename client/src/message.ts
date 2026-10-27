import * as Schema from "effect/Schema";
import { defineMessageUnion } from "foldkit/message";
import { RunKind, Status, TaskResult, Tool } from "./model";

export const Message = defineMessageUnion({
  LoadedStatus: { status: Status, local: Schema.Boolean },
  FailedStatus: { reason: Schema.String },
  LoadedTools: { tools: Schema.Array(Tool) },
  ClickedReset: {},
  ClickedRun: { kind: RunKind },
  DidReset: {},
  Finished: { kind: RunKind, result: TaskResult },
  FailedAction: { reason: Schema.String },
});

export type Message = typeof Message.Type;
