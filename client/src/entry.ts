import { Runtime } from "foldkit";
import { LoadStatus } from "./command";
import { Message } from "./message";
import { Activity, Loaded, Model } from "./model";
import { update } from "./update";
import { view } from "./view";

const application = Runtime.makeElement({
  Model,
  init: () => ({ model: { loaded: Loaded.Loading(), tools: [], runs: [], activity: Activity.Idle() }, commands: [LoadStatus({})] }),
  update,
  view,
  container: document.getElementById("root"),
  devTools: { Message },
});

Runtime.run(application);
