import type { Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import { LoadTools, ResetDemo, RunDemo } from "./command";
import { Message } from "./message";
import { Activity, Loaded, type Model, type RunKind } from "./model";

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
    LoadedTools: ({ tools }) => only(modifyFields(model, { tools: () => tools })),
    ClickedReset: () => ({
      model: modifyFields(model, { activity: () => Activity.Busy({ label: "Removing json5 and tsc from the registry" }) }),
      commands: [ResetDemo({})],
    }),
    DidReset: () => ({ model: modifyFields(model, { activity: () => Activity.Idle(), runs: () => [] }), commands: [LoadTools({})] }),
    ClickedRun: ({ kind }) => ({
      model: modifyFields(model, { activity: () => Activity.Busy({ label: `Running ${LABEL[kind]}` }) }),
      commands: [RunDemo({ kind })],
    }),
    Finished: ({ kind, result }) => ({
      model: modifyFields(model, {
        activity: () => Activity.Idle(),
        runs: (runs) => [{ kind, label: LABEL[kind], result, at: runs.length + 1 }, ...runs],
      }),
      commands: [LoadTools({})],
    }),
    FailedAction: ({ reason }) => only(modifyFields(model, { activity: () => Activity.Failed({ reason }) })),
  });
