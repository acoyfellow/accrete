import * as Schema from "effect/Schema";
import { defineTaggedUnion } from "foldkit/schema";

export const Build = Schema.Struct({
  name: Schema.String,
  hash: Schema.String,
  bytes: Schema.Number,
  nativeMatchesBuilt: Schema.Boolean,
  buildSeconds: Schema.Number,
  containerSeconds: Schema.Number,
});

export type Build = typeof Build.Type;

export const Call = Schema.Struct({
  op: Schema.String,
  placement: Schema.Literals(["isolate", "built-tool", "container"]),
  tool: Schema.optional(Schema.String),
  hash: Schema.optional(Schema.String),
  ms: Schema.Number,
  containerSeconds: Schema.Number,
  ok: Schema.Boolean,
  error: Schema.optional(Schema.String),
  build: Schema.optional(Build),
});

export type Call = typeof Call.Type;

export const TaskResult = Schema.Struct({
  ok: Schema.Boolean,
  files: Schema.Record(Schema.String, Schema.String),
  logs: Schema.Array(Call),
});

export type TaskResult = typeof TaskResult.Type;

export const Tool = Schema.Struct({ name: Schema.String, version: Schema.String, hash: Schema.String, registeredAt: Schema.String });

export type Tool = typeof Tool.Type;

export const Proven = Schema.Struct({ claim: Schema.String, experiment: Schema.String, receipt: Schema.String, observed: Schema.String });

export const Unproven = Schema.Struct({ claim: Schema.String, why: Schema.String });

export const Disproven = Schema.Struct({ claim: Schema.String, receipt: Schema.String, observed: Schema.String });

export const Status = Schema.Struct({
  iteration: Schema.Number,
  northStar: Schema.String,
  constraint: Schema.String,
  falsifiable: Schema.String,
  proven: Schema.Array(Proven),
  unproven: Schema.Array(Unproven),
  disproven: Schema.Array(Disproven),
  openQuestions: Schema.Array(Schema.String),
});

export type Status = typeof Status.Type;

export const Loaded = defineTaggedUnion({
  Loading: {},
  Ready: { status: Status, local: Schema.Boolean },
  Failed: { reason: Schema.String },
});

export type Loaded = typeof Loaded.Type;

export const RunKind = Schema.Literals(["script", "cold", "self"]);

export type RunKind = typeof RunKind.Type;

export const Run = Schema.Struct({ kind: RunKind, label: Schema.String, result: TaskResult, at: Schema.Number });

export type Run = typeof Run.Type;

export const Activity = defineTaggedUnion({
  Idle: {},
  Busy: { label: Schema.String },
  Failed: { reason: Schema.String },
});

export type Activity = typeof Activity.Type;

export const Model = Schema.Struct({
  loaded: Loaded,
  tools: Schema.Array(Tool),
  runs: Schema.Array(Run),
  activity: Activity,
});

export type Model = typeof Model.Type;
