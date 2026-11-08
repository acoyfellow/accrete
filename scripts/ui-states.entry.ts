import { Message } from "../client/src/message";
import { Activity, Loaded, type Model, Registry } from "../client/src/model";
import { update } from "../client/src/update";

const status = { iteration: 1, northStar: "", constraint: "", falsifiable: "", proven: [], unproven: [], disproven: [], openQuestions: [] };

const start: Model = { loaded: Loaded.Loading(), registry: Registry.Unknown(), runs: [], activity: Activity.Idle() };

const result = { ok: true, files: {}, logs: [] };

type Check = { readonly name: string; readonly pass: boolean };

const checks: Array<Check> = [];

const check = (name: string, pass: boolean) => checks.push({ name, pass });

const step = (model: Model, message: Message) => update(model, message);

const failedLoad = step(start, Message.FailedStatus({ reason: "down" }));
check("a failed status load shows Failed", failedLoad.model.loaded._tag === "Failed");

const retried = step(failedLoad.model, Message.ClickedRetry());
check("retry goes back to Loading and asks for the status again", retried.model.loaded._tag === "Loading" && retried.commands.length === 1);

const ready = step(retried.model, Message.LoadedStatus({ status, local: true }));
check("a loaded status shows Ready and loads the registry", ready.model.loaded._tag === "Ready" && ready.commands.length === 1);
check("the registry is Unknown until it answers", ready.model.registry._tag === "Unknown");

const registryDown = step(ready.model, Message.FailedTools({ reason: "Could not load the registry." }));
check("a failed registry load is Unreachable and does not touch the run state", registryDown.model.registry._tag === "Unreachable" && registryDown.model.activity._tag === "Idle");

const known = step(registryDown.model, Message.LoadedTools({ tools: [] }));
check("an empty registry is Known with 0 tools, not loading", known.model.registry._tag === "Known");

const busy = step(known.model, Message.ClickedRun({ kind: "script" }));
check("a click starts one run", busy.model.activity._tag === "Busy" && busy.commands.length === 1);

const doubleClick = step(busy.model, Message.ClickedRun({ kind: "cold" }));
check("a second click while busy starts nothing", doubleClick.commands.length === 0 && doubleClick.model === busy.model);

const resetWhileBusy = step(busy.model, Message.ClickedReset());
check("reset while busy starts nothing", resetWhileBusy.commands.length === 0);

const failed = step(busy.model, Message.FailedAction({ action: "script", reason: "no" }));
check("a failure remembers which action failed", failed.model.activity._tag === "Failed" && failed.model.activity.action === "script");

const again = step(failed.model, Message.ClickedRun({ kind: "cold" }));
check("after a failure the next click runs", again.model.activity._tag === "Busy" && again.commands.length === 1);

const finished = step(again.model, Message.Finished({ kind: "cold", result }));
check("a finished run is kept and the state goes back to Idle", finished.model.activity._tag === "Idle" && finished.model.runs.length === 1);

const reset = step(step(finished.model, Message.ClickedReset()).model, Message.DidReset());
check("reset clears runs and goes back to Idle", reset.model.runs.length === 0 && reset.model.activity._tag === "Idle");

for (const entry of checks) console.log(`${entry.pass ? "PASS" : "FAIL"} ${entry.name}`);

const failures = checks.filter((entry) => !entry.pass).length;
console.log(failures === 0 ? `UI STATES PASS: ${checks.length} checks` : `UI STATES FAIL: ${failures} of ${checks.length}`);
if (failures > 0) process.exitCode = 1;
