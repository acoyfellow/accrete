import type { Html, HtmlBuilder } from "foldkit/html";
import { Message } from "./message";
import numbers from "./numbers.json";
import { Activity, type Call, Loaded, type Model, type Run, type Tool } from "./model";

type H = HtmlBuilder<Message>;

const REPO = "https://github.com/acoyfellow/accrete";

const vars = (h: H, values: Record<string, string>) => h.Style(values);

const ms = (value: number): string => `${value}ms`;

const tape = (h: H, text: string, extra: string): Html =>
  h.div([h.Class(`tape ${extra}`)], [h.span([], [text.repeat(4)])]);

const headlineLine = (h: H, text: string, kind: "strike" | "new", delay: string, slash: string): Html =>
  h.span([h.Class("line")], [h.span([h.Class(kind === "strike" ? "strike" : "new pop"), vars(h, { "--d": delay, "--d2": slash })], [text])]);

const ELI5: ReadonlyArray<readonly [string, string, string]> = [
  ["🤖", "agent needs a tool", "\"format this YAML\""],
  ["📦🔥", "first time: build it", "in a container, once"],
  ["🔒", "check + save it", "same output as the real one"],
  ["⚡", "every time after", "instant · no container"],
];

const eli5 = (h: H): Html =>
  h.ol([h.Class("eli5"), h.AriaLabel("How accrete works")], ELI5.map(([icon, title, sub], index) =>
    h.li([vars(h, { "--i": String(index) })], [h.span([h.Class("ico")], [icon]), h.b([], [title]), h.small([], [sub])]),
  ));

const hero = (h: H): Html =>
  h.header([], [
    h.h1([], [
      headlineLine(h, "CONTAINERS", "strike", ms(2900), ms(3900)),
      headlineLine(h, "EVERY TIME", "strike", ms(3050), ms(4100)),
      headlineLine(h, "ONCE.", "new", ms(4500), ms(0)),
      headlineLine(h, "THEN NEVER.", "new", ms(4650), ms(0)),
    ]),
    eli5(h),
    h.div([vars(h, { position: "relative" })], [
      h.div([h.Class("card in"), vars(h, { "--d": ms(3300) })], []),
      h.div([h.Class("sticker s1 in"), vars(h, { "--d": ms(4900) })], ["IT EATS SERVERS 🍬"]),
      h.div([h.Class("sticker s2 in"), vars(h, { "--d": ms(5100) })], [`${numbers.current.repeatCs} LOL`]),
    ]),
  ]);

type ReceiptRun = { readonly title: string; readonly body: string; readonly cs: string; readonly kind: "cost" | "zero" };

const RECEIPT_RUNS: ReadonlyArray<ReceiptRun> = [
  { title: "BASELINE · COLD", body: `held-out ${numbers.baseline.coverage} tools built. score ${numbers.baseline.score}.`, cs: numbers.baseline.coldCs, kind: "cost" },
  { title: "NOW · COLD", body: `held-out ${numbers.current.coverage} tools, train ${numbers.current.trainCoverage}. pass ${numbers.current.passRate}.`, cs: numbers.current.coldCs, kind: "cost" },
  { title: "NOW · AGAIN", body: `from the registry. p50 ${numbers.current.repeatP50}. no container.`, cs: numbers.current.repeatCs, kind: "zero" },
  { title: "FALSIFY · REPEAT", body: `${numbers.falsify.filter((test) => test.pass).length}/${numbers.falsify.length} falsification tests pass.`, cs: numbers.repeatCsFalsify, kind: "zero" },
];

const xp = (h: H): Html =>
  h.div([h.Class("xp in"), vars(h, { "--d": ms(5300) })], [
    h.b([h.Class("lv")], []),
    h.div([h.Class("track")], [h.i([], [])]),
    h.span([h.Class("tag")], [`${numbers.kept.length} KEPT · ${numbers.current.tools.length} TOOLS · ${numbers.current.repeatCs} ON REPEAT`]),
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
    h.p([], ["Reset clears json5 and tsc. The first run forges the tool in a container. Run it again: no container. The tsc run checks accrete's own source."]),
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
    h.div([h.Class("meter reveal")], ["CONTAINER-SECONDS, NEXT RUN", h.b([vars(h, { "--cold": String(Math.round(parseFloat(numbers.current.coldCs) * 100)) })], [])]),
  ]);

const receiptLink = (h: H, path: string): Html => h.a([h.Href(`${REPO}/blob/main/${path}`)], [path]);

const builtRows = numbers.toolRows.filter((row) => row.ok);

const medianSpeedup = (): string => {
  const values = builtRows.map((row) => parseInt(row.speedup, 10)).sort((first, second) => first - second);
  return values.length === 0 ? "—" : `${values[Math.floor(values.length / 2)]}×`;
};

const GLANCE: ReadonlyArray<readonly [string, string]> = [
  [`${builtRows.length}/${numbers.toolRows.length}`, "real npm tools forged"],
  [numbers.current.repeatCs, "container time on repeat"],
  [medianSpeedup(), "faster on repeat (median)"],
  [`${numbers.falsify.filter((test) => test.pass).length}/${numbers.falsify.length}`, "attacks refused"],
];

type Alternative = { readonly name: string; readonly repeat: string; readonly start: string; readonly network: string; readonly checked: string; readonly us: boolean };

const ALTERNATIVES: ReadonlyArray<Alternative> = [
  { name: "accrete", repeat: numbers.current.repeatCs, start: numbers.current.repeatP50, network: "none, tested", checked: "byte-for-byte vs real tool", us: true },
  { name: "container per call", repeat: "a full boot, every call", start: "seconds", network: "usually open", checked: "no", us: false },
  { name: "warm container pool", repeat: "billed while idle", start: "fast, until it scales", network: "usually open", checked: "no", us: false },
  { name: "agent rewrites the tool", repeat: "0s, but", start: "fast", network: "none", checked: "no — it might be wrong", us: false },
];

const COLUMNS = ["", "container time, repeat", "start, repeat", "network", "output checked"];

const alternativeRow = (h: H, row: Alternative): Html =>
  h.div([h.Class(row.us ? "vs-row us" : "vs-row")], [
    h.b([], [row.name]),
    ...[row.repeat, row.start, row.network, row.checked].map((value, index) => h.span([h.DataAttribute("k", COLUMNS[index + 1] ?? "")], [value])),
  ]);

const toolRow = (h: H, row: (typeof numbers.toolRows)[number]): Html =>
  h.div([h.Class(row.ok ? "tool-row" : "tool-row miss")], [
    h.b([], [row.tool, h.i([], [row.set === "heldout" ? "held-out" : "train"])]),
    h.span([h.DataAttribute("k", "first run")], [row.ok ? `${row.coldCs} container` : "can't forge yet"]),
    h.span([h.DataAttribute("k", "every run after")], [row.ok ? `${row.repeatMs} ms · ${row.repeatCs}` : "—"]),
    h.span([h.Class("x"), h.DataAttribute("k", "faster")], [row.speedup]),
  ]);

const numbersSection = (h: H): Html =>
  h.section([h.Id("numbers"), h.Class("numbers")], [
    h.h2([h.Class("reveal")], ["THE NUMBERS"]),
    h.div([h.Class("glance")], GLANCE.map(([value, label]) => h.div([h.Class("reveal")], [h.b([], [value]), h.span([], [label])]))),
    h.h3([], ["vs. the other ways"]),
    h.div([h.Class("vs")], [h.div([h.Class("vs-row head")], COLUMNS.map((name) => h.span([], [name]))), ...ALTERNATIVES.map((row) => alternativeRow(h, row))]),
    h.h3([], ["every tool, measured"]),
    h.div([h.Class("tools")], numbers.toolRows.map((row) => toolRow(h, row))),
    h.p([h.Class("fine")], ["accrete cells come from sealed bench receipts. Held-out tools were frozen before tuning. Other rows describe how those setups work, not a benchmark."]),
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
        numbersSection(h),
        zine(h),
        footer(h),
      ]),
  });
