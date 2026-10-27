import type { Html, HtmlBuilder } from "foldkit/html";
import { Message } from "./message";
import { Activity, type Call, Loaded, type Model, type Run, type Status, type Tool } from "./model";

type H = HtmlBuilder<Message>;

const REPO = "https://github.com/acoyfellow/accrete";

const PLACEMENT: Record<Call["placement"], { readonly label: string; readonly tone: string }> = {
  isolate: { label: "isolate", tone: "bg-stone-200 text-stone-700" },
  "built-tool": { label: "registry", tone: "bg-emerald-100 text-held" },
  container: { label: "container", tone: "bg-orange-100 text-ore" },
};

const eyebrow = (h: H, text: string): Html => h.p([h.Class("font-mono text-[11px] uppercase tracking-[0.18em] text-faint")], [text]);

const heading = (h: H, id: string, kicker: string, title: string): Html =>
  h.div([h.Class("flex flex-col gap-1")], [eyebrow(h, kicker), h.h2([h.Id(id), h.Class("scroll-mt-20 text-[26px] font-semibold tracking-tight")], [title])]);

const prose = (h: H, text: string): Html => h.p([h.Class("max-w-2xl text-[15px] leading-7 text-dim")], [text]);

const codeBlock = (h: H, lines: ReadonlyArray<string>): Html =>
  h.pre([h.Class("overflow-auto rounded-xl border border-rule bg-ink p-4 font-mono text-[12.5px] leading-6 text-stone-100")], [lines.join("\n")]);

const nav = (h: H): Html =>
  h.nav(
    [h.Class("sticky top-0 z-10 border-b border-rule bg-paper/90 backdrop-blur")],
    [
      h.div([h.Class("mx-auto flex max-w-5xl items-center gap-6 px-6 py-3 text-[13px]")], [
        h.a([h.Href("#top"), h.Class("font-mono font-semibold text-ink")], ["accrete"]),
        ...[
          ["#demo", "Demo"],
          ["#how", "How it works"],
          ["#ledger", "Ledger"],
          ["#run", "Run it"],
          ["#limits", "Limits"],
        ].map(([href, label]) => h.a([h.Href(href ?? "#"), h.Class("text-dim hover:text-ink")], [label ?? ""])),
        h.a([h.Href("/llms.txt"), h.Class("ml-auto font-mono text-faint hover:text-ink")], ["llms.txt"]),
      ]),
    ],
  );

const hero = (h: H, status: Status | null): Html =>
  h.header(
    [h.Id("top"), h.Class("mx-auto flex max-w-5xl flex-col gap-6 px-6 pb-12 pt-16")],
    [
      eyebrow(h, `notebook · iteration ${status?.iteration ?? "…"}`),
      h.h1([h.Class("max-w-3xl text-[44px] font-semibold leading-[1.05] tracking-tight")], ["Build a tool once. Then run it with no container."]),
      prose(
        h,
        "Coding agents need tools like tsc, json5 and markdown renderers. Running each one in a container on every call costs seconds and money, every time. accrete builds a missing tool once, checks it against the real tool, and stores it. After that it runs in a Worker isolate.",
      ),
      h.div([h.Class("flex flex-wrap gap-3 pt-2")], [
        h.a([h.Href("#demo"), h.Class("rounded-lg bg-ink px-4 py-2 text-[14px] font-medium text-paper")], ["Try the demo"]),
        h.a([h.Href("#ledger"), h.Class("rounded-lg border border-rule px-4 py-2 text-[14px] text-ink")], ["Read the evidence"]),
      ]),
    ],
  );

const claimCard = (h: H, status: Status): Html =>
  h.section([h.Class("mx-auto max-w-5xl px-6")], [
    h.div([h.Class("grid gap-4 rounded-2xl border border-rule bg-card p-6 md:grid-cols-[1fr_1.4fr]")], [
      h.div([h.Class("flex flex-col gap-2")], [eyebrow(h, "the claim"), h.p([h.Class("text-[18px] font-medium leading-7")], [status.falsifiable])]),
      h.div([h.Class("flex flex-col gap-2 border-rule md:border-l md:pl-6")], [
        eyebrow(h, "the rule every built tool obeys"),
        h.p([h.Class("text-[14px] leading-6 text-dim")], [status.constraint]),
      ]),
    ]),
  ]);

const placementBadge = (h: H, call: Call): Html => {
  const style = PLACEMENT[call.placement];
  return h.span([h.Class(`rounded-md px-2 py-0.5 font-mono text-[11px] ${style.tone}`)], [style.label]);
};

const callRow = (h: H, call: Call): Html =>
  h.tr([h.Class("border-t border-rule")], [
    h.td([h.Class("py-2 pr-3 font-mono text-[12px]")], [call.tool?.split("@")[0] ?? call.op]),
    h.td([h.Class("py-2 pr-3")], [placementBadge(h, call)]),
    h.td([h.Class("py-2 pr-3 text-right font-mono text-[12px]")], [`${call.ms} ms`]),
    h.td([h.Class(`py-2 text-right font-mono text-[12px] ${call.containerSeconds > 0 ? "text-ore" : "text-held"}`)], [`${call.containerSeconds.toFixed(2)} s`]),
  ]);

const reportOf = (run: Run): string | null => {
  const report = run.result.files["reports/tsc.txt"];
  if (run.kind !== "self" || report === undefined) return null;
  return report === "" ? "tsc: no errors" : report;
};

const runCard = (h: H, run: Run): Html => {
  const total = run.result.logs.reduce((sum, call) => sum + call.containerSeconds, 0);
  const build = run.result.logs.find((call) => call.build !== undefined)?.build;
  const report = reportOf(run);
  const output = run.kind === "cold" ? run.result.files["app.json"] : undefined;
  return h.article([h.Class("flex flex-col gap-3 rounded-xl border border-rule bg-card p-4")], [
    h.div([h.Class("flex items-baseline gap-3")], [
      h.span([h.Class("font-mono text-[11px] text-faint")], [`run ${run.at}`]),
      h.span([h.Class("text-[14px] font-medium")], [run.label]),
      h.span([h.Class(`ml-auto font-mono text-[13px] font-semibold ${total > 0 ? "text-ore" : "text-held"}`)], [`${total.toFixed(2)} container-seconds`]),
    ]),
    h.table([h.Class("w-full")], [
      h.thead([], [
        h.tr([h.Class("text-left font-mono text-[10px] uppercase tracking-wider text-faint")], [
          h.th([h.Class("pb-1")], ["step"]),
          h.th([h.Class("pb-1")], ["ran in"]),
          h.th([h.Class("pb-1 text-right")], ["time"]),
          h.th([h.Class("pb-1 text-right")], ["container"]),
        ]),
      ]),
      h.tbody([], run.result.logs.map((call) => callRow(h, call))),
    ]),
    ...(build
      ? [
          h.p([h.Class("rounded-lg bg-orange-50 px-3 py-2 font-mono text-[12px] leading-5 text-ore")], [
            `built ${build.name} in the container: ${(build.bytes / 1024).toFixed(0)} KB bundle, native output matched = ${build.nativeMatchesBuilt}, hash ${build.hash.slice(0, 12)}`,
          ]),
        ]
      : []),
    ...(report ? [h.pre([h.Class("max-h-40 overflow-auto rounded-lg bg-stone-100 px-3 py-2 font-mono text-[12px] text-held")], [report])] : []),
    ...(output ? [h.pre([h.Class("max-h-40 overflow-auto rounded-lg bg-stone-100 px-3 py-2 font-mono text-[12px]")], [output])] : []),
    ...(run.result.ok ? [] : [h.p([h.Class("font-mono text-[12px] text-broken")], [run.result.logs.at(-1)?.error ?? "failed"])]),
  ]);
};

const toolList = (h: H, tools: ReadonlyArray<Tool>): Html =>
  h.div([h.Class("flex flex-col gap-2 rounded-xl border border-rule bg-card p-4")], [
    eyebrow(h, `registry · ${tools.length} tools`),
    ...(tools.length === 0
      ? [h.p([h.Class("text-[13px] text-faint")], ["empty"])]
      : tools.map((tool) =>
          h.div([h.Class("flex items-baseline gap-2 font-mono text-[12px]")], [
            h.span([h.Class("font-semibold")], [tool.name]),
            h.span([h.Class("truncate text-faint")], [tool.version.split("+")[0] ?? tool.version]),
            h.span([h.Class("ml-auto text-faint")], [tool.hash.slice(0, 8)]),
          ]),
        )),
  ]);

const button = (h: H, label: string, message: Message, busy: boolean, primary: boolean): Html =>
  h.button(
    [
      h.Type("button"),
      h.Disabled(busy),
      h.OnClick(message),
      h.Class(`rounded-lg px-4 py-2 text-[14px] font-medium disabled:opacity-40 ${primary ? "bg-ink text-paper" : "border border-rule text-ink"}`),
    ],
    [label],
  );

const demo = (h: H, model: Model, local: boolean): Html => {
  const busy = Activity.guards.Busy(model.activity);
  return h.section([h.Class("mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16")], [
    heading(h, "demo", "dogfood", "Watch a tool get built, then reused"),
    prose(
      h,
      "Reset removes json5 and tsc from the registry. The first run of each task has to build its tool in the container. Run it again and the same task uses the registry copy: 0 container-seconds. The tsc task type-checks accrete's own source.",
    ),
    local
      ? h.div([h.Class("flex flex-wrap items-center gap-3")], [
          button(h, "1. Reset registry", Message.ClickedReset(), busy, false),
          button(h, "2. Run json5 task", Message.ClickedRun({ kind: "cold" }), busy, true),
          button(h, "3. Check accrete with accrete", Message.ClickedRun({ kind: "self" }), busy, true),
          Activity.match(model.activity, {
            Idle: () => h.span([], []),
            Busy: ({ label }) => h.span([h.Class("font-mono text-[12px] text-ore")], [`${label}…`]),
            Failed: ({ reason }) => h.span([h.Class("font-mono text-[12px] text-broken")], [reason]),
          }),
        ])
      : h.p([h.Class("rounded-lg border border-rule bg-card px-4 py-3 text-[14px] text-dim")], [
          "The live demo runs only in local dev, because it starts a container. Clone the repo and run it locally (see Run it).",
        ]),
    h.div([h.Class("grid gap-4 md:grid-cols-[1fr_16rem]")], [
      h.div(
        [h.Class("flex flex-col gap-3")],
        model.runs.length === 0 ? [h.p([h.Class("rounded-xl border border-dashed border-rule px-4 py-8 text-center text-[13px] text-faint")], ["No runs yet."])] : model.runs.map((run) => runCard(h, run)),
      ),
      toolList(h, model.tools),
    ]),
  ]);
};

const step = (h: H, n: string, title: string, body: string): Html =>
  h.li([h.Class("flex flex-col gap-1 rounded-xl border border-rule bg-card p-4")], [
    h.span([h.Class("font-mono text-[11px] text-ore")], [n]),
    h.span([h.Class("text-[15px] font-medium")], [title]),
    h.span([h.Class("text-[13px] leading-6 text-dim")], [body]),
  ]);

const how = (h: H): Html =>
  h.section([h.Class("mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16")], [
    heading(h, "how", "how it works", "One flow, one rule"),
    h.ol([h.Class("grid gap-3 md:grid-cols-4")], [
      step(h, "01", "Task arrives", "A workspace Durable Object holds the files. Read, write and edit steps run in a Worker isolate."),
      step(h, "02", "Registry first", "A tool step looks up the tool by name. A hit loads the bundle from R2 and runs it in an isolate."),
      step(h, "03", "Miss: build once", "The builder container installs the npm package and bundles it with esbuild. Then it stops."),
      step(h, "04", "Check, then store", "The bundle must print the same output as the native tool on a check case. Only then is it stored, by content hash."),
    ]),
    prose(
      h,
      "The load-bearing primitive is Worker Loader: it runs a stored bundle in a fresh isolate with no network and no bindings. The tool contract is run({ args, files }) → { stdout, files }.",
    ),
  ]);

const ledgerRow = (h: H, tone: string, mark: string, claim: string, detail: string, receipt: string | null): Html =>
  h.li([h.Class("grid grid-cols-[1.5rem_1fr] gap-3 border-t border-rule py-4")], [
    h.span([h.Class(`font-mono text-[14px] font-bold ${tone}`)], [mark]),
    h.div([h.Class("flex flex-col gap-1")], [
      h.span([h.Class("text-[15px] font-medium")], [claim]),
      h.span([h.Class("text-[13px] leading-6 text-dim")], [detail]),
      ...(receipt ? [h.a([h.Href(`${REPO}/blob/main/${receipt}`), h.Class("font-mono text-[11px] text-faint hover:text-ink")], [receipt])] : []),
    ]),
  ]);

const ledger = (h: H, status: Status): Html =>
  h.section([h.Class("mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16")], [
    heading(h, "ledger", "evidence", "Proven, unproven, disproven"),
    prose(h, "A claim moves to proven only with a receipt from a real run. A projection never counts. Negative results stay on the page."),
    h.div([h.Class("grid gap-8 md:grid-cols-3")], [
      h.div([], [
        eyebrow(h, `proven · ${status.proven.length}`),
        h.ul([], status.proven.map((item) => ledgerRow(h, "text-held", "✓", item.claim, item.observed, item.receipt))),
      ]),
      h.div([], [
        eyebrow(h, `unproven · ${status.unproven.length}`),
        h.ul([], status.unproven.map((item) => ledgerRow(h, "text-open", "?", item.claim, item.why, null))),
      ]),
      h.div([], [
        eyebrow(h, `disproven · ${status.disproven.length}`),
        h.ul([], status.disproven.map((item) => ledgerRow(h, "text-broken", "✗", item.claim, item.observed, item.receipt))),
      ]),
    ]),
  ]);

const runIt = (h: H): Html =>
  h.section([h.Class("mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16")], [
    heading(h, "run", "run it", "Local, end to end"),
    prose(h, "Needs Node 22 and Docker. The builder container runs in local Docker; nothing is deployed."),
    codeBlock(h, ["git clone https://github.com/acoyfellow/accrete && cd accrete", "npm install", "npm run dev        # Worker on :8799, site on :5281", "npm run gate:local # the slice 2 gate against local dev"]),
    prose(h, "The gate prints PASS or FAIL for each check and writes JSON receipts to proof/receipts/."),
  ]);

const limits = (h: H, status: Status): Html =>
  h.section([h.Class("mx-auto flex max-w-5xl flex-col gap-6 px-6 py-16")], [
    heading(h, "limits", "non-goals", "What it does not do"),
    h.ul([h.Class("grid gap-3 md:grid-cols-2")], [
      ...[
        "Built tools get no network and no secrets. A tool that needs either stays out of the registry.",
        "Only npm tools that esbuild can bundle to plain JavaScript. Native binaries, such as TypeScript 7, cannot move off the container.",
        "The write API (/task, /build, /recipes) needs a bearer token. The demo actions run only on localhost.",
        "Registry entries are immutable and named by content hash. There is no update in place.",
      ].map((text) => h.li([h.Class("rounded-xl border border-rule bg-card p-4 text-[14px] leading-6 text-dim")], [text])),
    ]),
    h.div([h.Class("flex flex-col gap-2")], [
      eyebrow(h, "open questions"),
      h.ul([h.Class("list-disc pl-5 text-[14px] leading-7 text-dim")], status.openQuestions.map((question) => h.li([], [question]))),
    ]),
  ]);

const footer = (h: H): Html =>
  h.footer([h.Class("border-t border-rule")], [
    h.div([h.Class("mx-auto flex max-w-5xl gap-6 px-6 py-8 font-mono text-[12px] text-faint")], [
      h.span([], ["accrete · MIT"]),
      h.a([h.Href("/status.json"), h.Class("hover:text-ink")], ["status.json"]),
      h.a([h.Href("/llms.txt"), h.Class("hover:text-ink")], ["llms.txt"]),
    ]),
  ]);

export const view = (model: Model, h: H): Html =>
  Loaded.match(model.loaded, {
    Loading: () => h.main([h.Class("min-h-screen")], [nav(h), hero(h, null)]),
    Failed: ({ reason }) => h.main([h.Class("min-h-screen")], [nav(h), hero(h, null), h.p([h.Class("mx-auto max-w-5xl px-6 font-mono text-broken")], [reason])]),
    Ready: ({ status, local }) =>
      h.main([h.Class("min-h-screen")], [nav(h), hero(h, status), claimCard(h, status), demo(h, model, local), how(h), ledger(h, status), runIt(h), limits(h, status), footer(h)]),
  });
