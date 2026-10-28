import { homedir } from "node:os";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { configFromEnv, knownTools, lift } from "./client.mjs";

const RECEIPTS_DIR = join(homedir(), ".accrete");
const MAX_STDOUT = 40_000;

type Totals = { calls: number; lifted: number; containerSeconds: number; ms: number };

const totals: Totals = { calls: 0, lifted: 0, containerSeconds: 0, ms: 0 };

const summary = (): string =>
  `accrete ${totals.lifted}/${totals.calls} no-boot · ${totals.containerSeconds.toFixed(2)} container-s`;

const AccreteParams = Type.Object({
  package: Type.String({ description: "npm package that ships the CLI, e.g. 'sass', 'terser', 'js-yaml'" }),
  args: Type.Array(Type.String(), { description: "CLI arguments, exactly as you would pass them to npx" }),
  inputs: Type.Optional(Type.Array(Type.String(), { description: "Files the CLI reads, relative to the working directory. Their content is sent; nothing else is." })),
  version: Type.Optional(Type.String({ description: "Exact version. Default: npm latest, pinned at first use." })),
  bin: Type.Optional(Type.String({ description: "Binary name if it differs from the package name, e.g. 'lessc' for 'less'" })),
});

export default function accrete(pi: ExtensionAPI) {
  pi.registerTool({
    name: "accrete_run",
    label: "accrete",
    description:
      "Run a pure npm CLI (formatters, compilers, minifiers, converters, linters) on your accrete Worker instead of with npx. " +
      "The first call builds the tool once in a container and checks it against the real CLI. Every later call runs the saved copy in an isolate in tens of milliseconds, with no network. " +
      "Use it for repeated, deterministic file transforms. Do not use it for tools that need the network, native binaries, or files you did not list in inputs.",
    parameters: AccreteParams,
    async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
      const config = configFromEnv();
      if (!config.ready) throw new Error("Set ACCRETE_URL and ACCRETE_TOKEN to your own accrete Worker. See https://accrete.customer0.dev/docs/tutorial");
      const result = await lift(config, {
        pkg: params.package,
        version: params.version,
        bin: params.bin,
        args: params.args,
        inputs: params.inputs ?? [],
        cwd: ctx.cwd,
        receiptsDir: RECEIPTS_DIR,
      });
      totals.calls += 1;
      totals.ms += result.ms;
      totals.containerSeconds += result.containerSeconds;
      if (result.placement === "built-tool") totals.lifted += 1;
      if (ctx.hasUI) ctx.ui.setStatus("accrete", summary());
      if (!result.ok) throw new Error(`${result.tool} failed on accrete: ${result.error}`);
      const head = `${result.tool} · ${result.placement === "built-tool" ? "no boot" : "built once in container"} · ${result.ms} ms · ${result.containerSeconds.toFixed(2)} container-s`;
      const files = result.written.length === 0 ? "" : `\nwrote: ${result.written.join(", ")}`;
      const stdout = result.stdout.length > MAX_STDOUT ? `${result.stdout.slice(0, MAX_STDOUT)}\n[truncated ${result.stdout.length - MAX_STDOUT} chars]` : result.stdout;
      return { content: [{ type: "text", text: `${head}${files}\n\n${stdout}` }], details: result };
    },
  });

  pi.registerCommand("accrete", {
    description: "Show accrete status: Worker, tools in the registry, and container-seconds this session",
    handler: async (_args, ctx) => {
      const config = configFromEnv();
      if (!config.ready) {
        ctx.ui.notify("accrete: set ACCRETE_URL and ACCRETE_TOKEN", "warning");
        return;
      }
      const tools = await knownTools(config);
      const names = Array.isArray(tools) ? tools.map((tool: { name: string }) => tool.name) : [];
      ctx.ui.notify(`${config.url} · ${names.length} tools · ${summary()}`, "info");
    },
  });
}
