import type { Html, HtmlBuilder } from "foldkit/html";
import { Message } from "./message";
import { Activity, type Call, Loaded, type Model, type Run, type Status, type Tool } from "./model";

type H = HtmlBuilder<Message>;

const REPO = "https://github.com/acoyfellow/accrete";

const vars = (h: H, values: Record<string, string>) => h.Style(values);

const tape = (h: H, text: string, extra: string): Html =>
  h.div([h.Class(`tape ${extra}`)], [h.span([], [text.repeat(4)])]);

const headlineLine = (h: H, text: string, kind: "strike" | "new", delay: string, slash: string): Html =>
  h.span([h.Class("line")], [h.span([h.Class(kind === "strike" ? "strike" : "new pop"), vars(h, { "--d": delay, "--d2": slash })], [text])]);

const hero = (h: H): Html =>
  h.header([], [
    h.h1([], [
      headlineLine(h, "CONTAINERS", "strike", "2.9s", "3.9s"),
      headlineLine(h, "EVERY TIME", "strike", "3.05s", "4.1s"),
      headlineLine(h, "ONCE.", "new", "4.5s", "0s"),
      headlineLine(h, "THEN NEVER.", "new", "4.65s", "0s"),
    ]),
    h.div([vars(h, { position: "relative" })], [
      h.div([h.Class("card in"), vars(h, { "--d": "3.3s" })], []),
      h.div([h.Class("sticker s1 in"), vars(h, { "--d": "4.9s" })], ["IT EATS SERVERS 🍬"]),
      h.div([h.Class("sticker s2 in"), vars(h, { "--d": "5.1s" })], ["0.00 SECONDS LOL"]),
    ]),
  ]);

const RECEIPT_RUNS: ReadonlyArray<{ readonly title: string; readonly body: string; readonly cs: string; readonly kind: "cost" | "zero" }> = [
  { title: "json5 · FORGED", body: "built once in a container. 28 KB. matches the real one.", cs: "2.69s", kind: "cost" },
  { title: "json5 · AGAIN", body: "from the registry. 3 ms. no container. lol.", cs: "0.00s", kind: "zero" },
  { title: "tsc · FORGED", body: "7.2 MB. type-checks accrete's own source.", cs: "5.66s", kind: "cost" },
  { title: "tsc · AGAIN", body: "105 ms. no errors. no container. ever.", cs: "0.00s", kind: "zero" },
];

const xp = (h: H): Html =>
  h.div([h.Class("xp in"), vars(h, { "--d": "5.3s" })], [
    h.b([h.Class("lv")], []),
    h.div([h.Class("track")], [h.i([], [])]),
    h.span([h.Class("tag")], ["4 RUNS · 2 TOOLS · 0.00s ON REPEAT"]),
  ]);

const receiptRuns = (h: H): Html =>
  h.div(
    [h.Class("runs")],
    RECEIPT_RUNS.map((run, index) =>
      h.div([h.Class(`run ${run.kind}`), vars(h, { "--i": String(index) })], [h.h3([], [run.title]), h.p([], [run.body]), h.div([h.Class("cs")], [run.cs])]),
    ),
  );

const containerTotal = (run: Run): number => run.result.logs.reduce((sum, call) => sum + call.containerSeconds, 0);

const callLine = (call: Call): string =>
  `${call.tool?.split("@")[0] ?? call.op} · ran in ${call.placement === "built-tool" ? "registry" : call.placement} · ${call.ms} ms`;

const outputOf = (run: Run): string | undefined => {
  if (run.kind === "cold") return run.result.files["app.json"];
  const report = run.result.files["reports/tsc.txt"];
  if (report === undefined) return undefined;
  return report === "" ? "tsc: no errors" : report;
};

const liveRun = (h: H, run: Run): Html => {
  const total = containerTotal(run);
  const build = run.result.logs.find((call) => call.build !== undefined)?.build;
  const output = outputOf(run);
  return h.div([h.Class(`liverun ${total > 0 ? "cost" : "zero"}`)], [
    h.div([h.Class("head")], [h.span([], [`RUN ${run.at} · ${run.label}`]), h.b([], [`${total.toFixed(2)}s`])]),
    ...run.result.logs.map((call) => h.div([h.Class("meta")], [callLine(call)])),
    ...(build ? [h.div([h.Class("meta")], [`forged ${build.name}: ${(build.bytes / 1024).toFixed(0)} KB · matches native = ${build.nativeMatchesBuilt} · ${build.hash.slice(0, 12)}`])] : []),
    ...(output ? [h.pre([], [output])] : []),
    ...(run.result.ok ? [] : [h.div([h.Class("meta")], [run.result.logs.at(-1)?.error ?? "failed"])]),
  ]);
};

const registry = (h: H, tools: ReadonlyArray<Tool>): Html =>
  h.div([h.Class("reg")], [
    h.b([], [`REGISTRY · ${tools.length}`]),
    ...(tools.length === 0 ? [h.span([], ["empty"])] : tools.map((tool) => h.div([], [`${tool.name} · ${tool.hash.slice(0, 8)}`]))),
  ]);

const button = (h: H, label: string, message: Message, busy: boolean, extra: string): Html =>
  h.button([h.Type("button"), h.Disabled(busy), h.OnClick(message), h.Class(`btn ${extra}`)], [label]);

const demo = (h: H, model: Model, local: boolean): Html => {
  const busy = Activity.guards.Busy(model.activity);
  return h.section([h.Id("demo"), h.Class("demo")], [
    h.h2([], ["DO IT YOURSELF"]),
    h.p([], ["Reset clears json5 and tsc. The first run forges the tool in a container. Run it again: 0.00s. The tsc run checks accrete's own source."]),
    ...(local
      ? [
          button(h, "1 · RESET", Message.ClickedReset(), busy, ""),
          button(h, "2 · RUN JSON5", Message.ClickedRun({ kind: "cold" }), busy, "go"),
          button(h, "3 · CHECK ACCRETE WITH ACCRETE", Message.ClickedRun({ kind: "self" }), busy, "go"),
          Activity.match(model.activity, {
            Idle: () => h.span([], []),
            Busy: ({ label }) => h.span([h.Class("status")], [`${label}…`]),
            Failed: ({ reason }) => h.span([h.Class("status bad")], [reason]),
          }),
        ]
      : [h.p([], ["The live demo starts a container, so it runs only in local dev. Clone it and run npm run dev."])]),
    h.div([h.Class("live")], [
      h.div([], model.runs.length === 0 ? [h.div([h.Class("empty")], ["no runs yet. press a button."])] : model.runs.map((run) => liveRun(h, run))),
      registry(h, model.tools),
    ]),
  ]);
};

const STEPS: ReadonlyArray<readonly [string, string, string]> = [
  ["01", "TASK LANDS", "A Durable Object holds the files. read, write, edit run in an isolate."],
  ["02", "REGISTRY FIRST", "Tool hit? Load the bundle from R2. Run it in a sealed isolate."],
  ["03", "MISS: FORGE ONCE", "A container installs the npm package, bundles it, and dies."],
  ["04", "PROVE IT", "Bundle output must equal the real tool's output. Then hash it. Then keep it."],
];

const how = (h: H): Html =>
  h.section(
    [h.Class("how")],
    STEPS.map(([n, title, body], index) =>
      h.div([h.Class("reveal"), vars(h, { "--r": `${index % 2 === 0 ? -1.5 : 1.5}deg` })], [h.i([], [n]), h.h3([], [title]), h.p([], [body])]),
    ),
  );

const fire = (h: H): Html =>
  h.section([h.Class("fire")], [
    h.div([h.Class("bg")], []),
    h.h2([h.Class("reveal"), vars(h, { "--r": "-4deg" })], ["WE SET YOUR CONTAINER BILL ON FIRE 🔥"]),
    h.div([h.Class("meter reveal")], ["CONTAINER-SECONDS, NEXT RUN", h.b([], [])]),
  ]);

const receiptLink = (h: H, path: string): Html => h.a([h.Href(`${REPO}/blob/main/${path}`)], [path]);

const ledger = (h: H, status: Status): Html =>
  h.section([h.Id("ledger"), h.Class("ledger")], [
    h.div([h.Class("reveal"), vars(h, { "--r": "-2deg" })], [
      h.h3([], [`PROVEN ✓ ${status.proven.length}`]),
      h.ul([], status.proven.map((item) => h.li([], [item.observed, receiptLink(h, item.receipt)]))),
    ]),
    h.div([h.Class("reveal"), vars(h, { "--r": "1.5deg" })], [
      h.h3([], [`NOT YET ? ${status.unproven.length}`]),
      h.ul([], status.unproven.map((item) => h.li([], [`${item.claim} ${item.why}`]))),
    ]),
    h.div([h.Class("reveal"), vars(h, { "--r": "-1deg" })], [
      h.h3([], [`WRONG ✗ ${status.disproven.length}`]),
      h.ul([], status.disproven.map((item) => h.li([], [item.observed, receiptLink(h, item.receipt)]))),
    ]),
  ]);

const RANSOM: ReadonlyArray<readonly [string, string, string, string, string]> = [
  ["your", "#fff", "#000", "-6deg", "Georgia"],
  ["tools", "#000", "#f38020", "4deg", "Impact"],
  ["should", "#0051c3", "#fff", "-2deg", "Courier"],
  ["LEVEL", "#faae40", "#000", "7deg", "Arial Black"],
  ["up", "#404041", "#fff", "-5deg", "Georgia"],
  ["not", "#fff", "#0051c3", "3deg", "Impact"],
  ["boot", "#000", "#fff", "-8deg", "Courier"],
  ["UP", "#f38020", "#000", "5deg", "Arial Black"],
];

const zine = (h: H): Html =>
  h.section([h.Class("zine")], [
    h.div(
      [h.Class("ransom")],
      RANSOM.map(([word, background, color, rotate, font]) => h.span([h.Class("reveal"), vars(h, { "--b": background, "--c": color, "--r": rotate, "--f": font })], [word])),
    ),
  ]);

const footer = (h: H): Html =>
  h.footer([], [
    h.span([], ["accrete · MIT · no containers were harmed. ok one was."]),
    h.span([], [h.a([h.Href("/status.json")], ["status.json"]), " · ", h.a([h.Href("/llms.txt")], ["llms.txt"])]),
  ]);

const boot = (h: H): Html => h.div([h.Class("boot")], [h.div([h.Class("gem")], [])]);

const stage = (h: H): Html =>
  h.section([h.Class("stage")], [
    tape(h, "⚠ YOUR AGENT IS RENTING A WHOLE COMPUTER TO RUN JSON5 ", "in"),
    hero(h),
    xp(h),
    receiptRuns(h),
  ]);

export const view = (model: Model, h: H): Html =>
  Loaded.match(model.loaded, {
    Loading: () => h.main([], [boot(h)]),
    Failed: ({ reason }) => h.main([], [stage(h), h.p([h.Class("status bad")], [reason])]),
    Ready: ({ status, local }) =>
      h.main([], [
        boot(h),
        h.div([h.Class("levelup")], [h.b([], ["LEVEL UP"])]),
        stage(h),
        demo(h, model, local),
        tape(h, "BUILD IT ONCE ★ CHECK IT AGAINST THE REAL ONE ★ HASH IT ★ NEVER BOOT A CONTAINER FOR IT AGAIN ★ ", "rev"),
        how(h),
        fire(h),
        ledger(h, status),
        zine(h),
        footer(h),
      ]),
  });
