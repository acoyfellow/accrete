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

const svgAttr = (h: H, attributes: Record<string, string>) => Object.entries(attributes).map(([key, value]) => h.Attribute(key, value));

const box = (h: H, x: number, y: number, width: number, height: number, extra: string): Html =>
  h.rect([h.Class(`box ${extra}`), ...svgAttr(h, { x: String(x), y: String(y), width: String(width), height: String(height) })], []);

const label = (h: H, x: number, y: number, text: string, extra: string): Html =>
  h.text([h.Class(extra), ...svgAttr(h, { x: String(x), y: String(y) })], [text]);

const firstTool = numbers.toolRows.find((row) => row.ok);

type Point = readonly [number, number];

type Layout = { readonly view: string; readonly agent: Point; readonly engine: Point; readonly container: Point; readonly registry: Point; readonly feed: string; readonly cold: string; readonly warm: string; readonly coldLabel: Point; readonly warmLabel: Point };

const WIDE: Layout = { view: "0 0 680 320", agent: [0, 112], engine: [255, 80], container: [520, 10], registry: [520, 214], feed: "M150 150 L255 150", cold: "M405 130 C460 130 460 48 520 48 M595 86 L595 214", warm: "M405 170 C460 170 460 252 520 252", coldLabel: [300, 2], warmLabel: [300, 286] };

const TALL: Layout = { view: "-10 0 340 500", agent: [85, 0], engine: [85, 120], container: [0, 330], registry: [170, 330], feed: "M160 76 L160 120", cold: "M120 260 C120 300 75 300 75 330 M150 368 L170 368", warm: "M200 260 C200 300 245 300 245 330", coldLabel: [0, 424], warmLabel: [0, 462] };

const NODE_WIDTH = 150;
const NODE_HEIGHT = 76;
const ENGINE_HEIGHT = 140;

const node = (h: H, [x, y]: Point, name: string, sub: string, kind: string): Html =>
  h.g([h.Class(`node ${kind}`)], [
    h.rect([...svgAttr(h, { x: String(x + 6), y: String(y + 6), width: String(NODE_WIDTH), height: String(NODE_HEIGHT), class: "shadow" })], []),
    box(h, x, y, NODE_WIDTH, NODE_HEIGHT, "face"),
    label(h, x + 14, y + 32, name, "t"),
    label(h, x + 14, y + 56, sub, "s"),
  ]);

const engine = (h: H, [x, y]: Point, clip: string): Html =>
  h.g([h.Class("node engine")], [
    h.defs([], [h.clipPath([h.Id(clip)], [h.rect([...svgAttr(h, { x: String(x), y: String(y), width: String(NODE_WIDTH), height: String(ENGINE_HEIGHT), rx: "14" })], [])])]),
    h.rect([...svgAttr(h, { x: String(x + 6), y: String(y + 6), width: String(NODE_WIDTH), height: String(ENGINE_HEIGHT), class: "shadow" })], []),
    h.image([...svgAttr(h, { href: "/art/monster.jpg", x: String(x), y: String(y - 10), width: String(NODE_WIDTH), height: String(NODE_WIDTH + 10), preserveAspectRatio: "xMidYMid slice", "clip-path": `url(#${clip})` })], []),
    box(h, x, y, NODE_WIDTH, ENGINE_HEIGHT, "frame"),
    h.rect([...svgAttr(h, { x: String(x + 10), y: String(y + ENGINE_HEIGHT - 34), width: "92", height: "24", class: "tag" })], []),
    label(h, x + 18, y + ENGINE_HEIGHT - 16, "ACCRETE", "tag-t"),
  ]);

const BADGE_CHAR = 9.4;

const badge = (h: H, [x, y]: Point, text: string, kind: string): Html =>
  h.g([h.Class(`badge ${kind}`)], [
    h.rect([...svgAttr(h, { x: String(x), y: String(y), width: String(Math.round(text.length * BADGE_CHAR + 20)), height: "28", rx: "14" })], []),
    label(h, x + 10, y + 21, text, "k"),
  ]);

const diagram = (h: H, layout: Layout, kind: string): Html =>
  h.svg([h.Class(kind), ...svgAttr(h, { viewBox: layout.view, role: "img" })], [
    h.path([h.Class("wire feed"), ...svgAttr(h, { d: layout.feed })], []),
    h.path([h.Class("wire cold"), ...svgAttr(h, { d: layout.cold })], []),
    h.path([h.Class("wire warm"), ...svgAttr(h, { d: layout.warm })], []),
    node(h, layout.agent, "AGENT", "needs a tool", "agent"),
    engine(h, layout.engine, `clip-${kind}`),
    node(h, layout.container, "CONTAINER", "run 1 only", "container"),
    node(h, layout.registry, "INSTANT", "no boot", "registry"),
    badge(h, layout.coldLabel, `RUN 1 · ${firstTool?.coldCs ?? ""} BOOT`, "cold-b"),
    badge(h, layout.warmLabel, `RUN 2+ · ${firstTool?.repeatMs ?? ""} MS · NO BOOT`, "warm-b"),
  ]);

const explainer = (h: H): Html =>
  h.figure([h.Class("explainer"), h.AriaLabel("An agent asks for a tool. The first time, accrete builds it in a container and checks it. After that, the agent runs the saved copy with no container.")], [
    h.figcaption([], ["HOW IT EATS THEM"]),
    diagram(h, WIDE, "wide"),
    diagram(h, TALL, "tall"),
  ]);

const USE_STEPS: ReadonlyArray<readonly [string, string, string]> = [
  ["1", "Deploy the Worker", `git clone ${REPO}\ncd accrete && npm install\nnpx wrangler secret put ACCRETE_TOKEN\nnpx wrangler deploy`],
  ["2", "Add a recipe", `PUT /recipes
{
  "name": "json5",
  "packages": { "json5": "2.2.3" },
  "entry": "export const run = ...",
  "native": { "bin": "json5", "args": ["-s","2","c.json5"] },
  "check":  { "args": ["-s","2","c.json5"], "files": { ... } }
}`],
  ["3", "Your agent calls a tool", `POST /task
{
  "workspace": "agent-42",
  "seed": { "app.json5": "{ name: 'x', }" },
  "steps": [{ "op": "tool", "name": "json5",
              "args": ["-s","2","app.json5"],
              "inputs": ["app.json5"] }]
}`],
];

const use = (h: H): Html =>
  h.section([h.Id("use"), h.Class("use")], [
    h.h2([], ["DEPLOY IT"]),
    h.p([h.Class("lede")], ["Not a library and not a SaaS. You deploy a Worker to your own Cloudflare account. Then your agent makes one HTTP call instead of booting a container. The first call to a tool builds and checks it. Every call after runs the saved copy in an isolate."]),
    h.div([h.Class("use-steps")], USE_STEPS.map(([n, title, code]) =>
      h.div([], [h.h3([], [h.i([], [n]), title]), h.pre([], [h.code([], [code])])]),
    )),
    h.div([h.Class("pi-block")], [
      h.div([], [
        h.h3([], ["Dogfood it from Pi"]),
        h.p([], ["The pi-accrete extension gives your agent an accrete_run tool. Repeated CLI work lifts from your laptop to your Worker, and stays fast."]),
        h.div([h.Class("cta")], [h.a([h.Href("/docs/how-to/use-with-pi/"), h.Class("primary")], ["INSTALL THE EXTENSION"]), h.a([h.Href("/docs/explanation/workflows/")], ["SEE THE WORKFLOW BENCH"])]),
      ]),
      h.pre([], [h.code([], ["pi install git:github.com/acoyfellow/accrete\nexport ACCRETE_URL=https://accrete.example.com\nexport ACCRETE_TOKEN=…"])]),
    ]),
    h.p([h.Class("fine")], ["All routes need Authorization: Bearer <ACCRETE_TOKEN>. Built tools get no network and no secrets. Works for npm CLIs that run in plain JavaScript; tools that need native binaries or eval stay in the container."]),
  ]);

const hero = (h: H): Html =>
  h.header([], [
    h.h1([], [
      headlineLine(h, "CONTAINERS", "strike", ms(2900), ms(3900)),
      headlineLine(h, "EVERY TIME", "strike", ms(3050), ms(4100)),
      headlineLine(h, "ONCE.", "new", ms(4500), ms(0)),
      headlineLine(h, "THEN NEVER.", "new", ms(4650), ms(0)),
    ]),
    explainer(h),
    h.div([h.Class("selfhost")], [
      h.p([], [h.b([], ["Open source. Runs in your own Cloudflare account."]), " Not a hosted service. You deploy one Worker; your agents call it instead of booting a container for every npm tool."]),
      h.div([h.Class("cta")], [h.a([h.Href("/docs/tutorials/first-deploy/"), h.Class("primary")], ["DEPLOY IT"]), h.a([h.Href("/docs/")], ["READ THE DOCS"]), h.a([h.Href(REPO)], ["GITHUB"])]),
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
    h.h2([h.Class("reveal"), vars(h, { "--r": "-4deg" })], ["WE SET YOUR CONTAINER BILL ON FIRE"]),
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
    h.span([], [h.a([h.Href("/docs/")], ["docs"]), " · ", h.a([h.Href(REPO)], ["github"]), " · ", h.a([h.Href("/status.json")], ["status.json"]), " · ", h.a([h.Href("/llms.txt")], ["llms.txt"])]),
  ]);

const boot = (h: H): Html => h.div([h.Class("boot")], [h.div([h.Class("gem")], [])]);

const stage = (h: H): Html =>
  h.section([h.Class("stage")], [
    tape(h, "YOUR AGENT IS RENTING A WHOLE COMPUTER TO RUN JSON5 / ", "in"),
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
        stage(h),
        demo(h, model, local),
        tape(h, "BUILD IT ONCE / CHECK IT AGAINST THE REAL ONE / HASH IT / NEVER BOOT A CONTAINER FOR IT AGAIN / ", "rev"),
        how(h),
        use(h),
        fire(h),
        numbersSection(h),
        zine(h),
        footer(h),
      ]),
  });
