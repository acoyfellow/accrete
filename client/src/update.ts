import type { Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import { LoadStatus, LoadTools, ResetDemo, RunDemo } from "./command";
import { Message } from "./message";
import { Activity, Loaded, type Model, Registry, type RunKind } from "./model";

type Return = Update.Return<Model, Message, never>;

const only = (model: Model): Return => ({ model, commands: [] });

const LABEL: Record<RunKind, string> = {
  script: "kept diff-checklist script",
  cold: "json5 task",
  self: "tsc on accrete's own src/",
};

export const update = (model: Model, message: Message): Return =>
  Message.match(message, {
    LoadedStatus: ({ status, local }) => ({ model: modifyFields(model, { loaded: () => Loaded.Ready({ status, local }) }), commands: [LoadTools({})] }),
    FailedStatus: ({ reason }) => only(modifyFields(model, { loaded: () => Loaded.Failed({ reason }) })),
    ClickedRetry: () => ({ model: modifyFields(model, { loaded: () => Loaded.Loading() }), commands: [LoadStatus({})] }),
    LoadedTools: ({ tools }) => only(modifyFields(model, { registry: () => Registry.Known({ tools }) })),
    FailedTools: ({ reason }) => only(modifyFields(model, { registry: () => Registry.Unreachable({ reason }) })),
    ClickedReset: () => Activity.guards.Busy(model.activity) ? only(model) : ({
      model: modifyFields(model, { activity: () => Activity.Busy({ action: "reset", label: "Removing json5 and tsc from the registry" }) }),
      commands: [ResetDemo({})],
    }),
    DidReset: () => ({ model: modifyFields(model, { activity: () => Activity.Idle(), runs: () => [] }), commands: [LoadTools({})] }),
    ClickedRun: ({ kind }) => Activity.guards.Busy(model.activity) ? only(model) : ({
      model: modifyFields(model, { activity: () => Activity.Busy({ action: kind, label: `Running ${LABEL[kind]}` }) }),
      commands: [RunDemo({ kind })],
    }),
    Finished: ({ kind, result }) => ({
      model: modifyFields(model, {
        activity: () => Activity.Idle(),
        runs: (runs) => [{ kind, label: LABEL[kind], result, at: runs.length + 1 }, ...runs],
      }),
      commands: [LoadTools({})],
    }),
    FailedAction: ({ action, reason }) => only(modifyFields(model, { activity: () => Activity.Failed({ action, reason }) })),
  });
