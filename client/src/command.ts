import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Command } from "foldkit";
import { Message } from "./message";
import { RunKind, Status, TaskResult, Tool } from "./model";

const StatusReply = Schema.Struct({ status: Status, local: Schema.Boolean });

const ErrorReply = Schema.Struct({ error: Schema.String });

const call = (path: string, method: "GET" | "POST") =>
  Effect.tryPromise(async () => {
    const response = await fetch(path, { method });
    const body: unknown = await response.json();
    return { ok: response.ok, body };
  });

const reasonOf = (body: unknown, fallback: string) =>
  Schema.decodeUnknownEffect(ErrorReply)(body).pipe(
    Effect.map((reply) => reply.error),
    Effect.orElseSucceed(() => fallback),
  );

export const LoadStatus = Command.define("LoadStatus", {
  args: {},
  messages: [Message.LoadedStatus, Message.FailedStatus],
  execute: () =>
    Effect.gen(function* () {
      const { body } = yield* call("/api/status", "GET");
      const reply = yield* Schema.decodeUnknownEffect(StatusReply)(body);
      return Message.LoadedStatus({ status: reply.status, local: reply.local });
    }).pipe(Effect.orElseSucceed(() => Message.FailedStatus({ reason: "Could not load /api/status." }))),
});

export const LoadTools = Command.define("LoadTools", {
  args: {},
  messages: [Message.LoadedTools, Message.FailedAction],
  execute: () =>
    Effect.gen(function* () {
      const { body } = yield* call("/api/tools", "GET");
      const tools = yield* Schema.decodeUnknownEffect(Schema.Array(Tool))(body);
      return Message.LoadedTools({ tools });
    }).pipe(Effect.orElseSucceed(() => Message.FailedAction({ reason: "Could not load the registry." }))),
});

export const ResetDemo = Command.define("ResetDemo", {
  args: {},
  messages: [Message.DidReset, Message.FailedAction],
  execute: () =>
    Effect.gen(function* () {
      const { ok, body } = yield* call("/api/reset", "POST");
      if (!ok) return Message.FailedAction({ reason: yield* reasonOf(body, "Reset failed.") });
      return Message.DidReset();
    }).pipe(Effect.orElseSucceed(() => Message.FailedAction({ reason: "Could not reach the Worker." }))),
});

export const RunDemo = Command.define("RunDemo", {
  args: { kind: RunKind },
  messages: [Message.Finished, Message.FailedAction],
  execute: ({ kind }) =>
    Effect.gen(function* () {
      const { ok, body } = yield* call(kind === "script" ? "/api/script/run" : `/api/run/${kind}`, "POST");
      if (!ok) return Message.FailedAction({ reason: yield* reasonOf(body, "Run failed.") });
      const result = yield* Schema.decodeUnknownEffect(TaskResult)(body);
      return Message.Finished({ kind, result });
    }).pipe(Effect.orElseSucceed(() => Message.FailedAction({ reason: "Could not reach the Worker." }))),
});
