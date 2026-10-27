import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SHIM = join(dirname(fileURLToPath(import.meta.url)), 'shim');

export const NODE_BUILTINS = ['fs', 'path', 'os', 'inspector', 'perf_hooks', 'crypto', 'buffer', 'util', 'url', 'module', 'assert', 'events', 'stream', 'child_process', 'worker_threads', 'v8', 'tty', 'readline', 'process', 'string_decoder', 'zlib', 'http', 'https', 'net', 'vm'];

const SHIMMED = { fs: 'fs.js', 'fs/promises': 'fs-promises.js' };

export const BANNER = "import{createRequire as __accreteCreateRequire}from'node:module';const require=__accreteCreateRequire('/tool.js');const __filename='/tool.js';const __dirname='/';";

const binPath = async (projectDir, cli) => {
  const manifest = JSON.parse(await readFile(join(projectDir, 'node_modules', cli.package, 'package.json'), 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[cli.bin];
  if (bin === undefined) throw new Error(`${cli.package} has no bin named ${cli.bin}`);
  return join(projectDir, 'node_modules', cli.package, bin);
};

export const cliEntry = async (projectDir, cli) => {
  const bin = await binPath(projectDir, cli);
  const manifest = await readFile(join(projectDir, 'node_modules', cli.package, 'package.json'), 'utf8');
  const manifests = JSON.stringify({ [cli.package]: manifest });
  return `import { runCli } from ${JSON.stringify(join(SHIM, 'cli.js'))};\nexport const run = (input) => runCli(input, () => import(${JSON.stringify(bin)}), ${manifests});\n`;
};

const shebangPlugin = {
  name: 'accrete-shebang',
  setup(builder) {
    builder.onLoad({ filter: new RegExp('[/]bin[/][^.]*$') }, async (args) => ({ contents: (await readFile(args.path, 'utf8')).replace(new RegExp('^#!.*'), ''), loader: 'js' }));
  },
};

export const bundleOptions = (projectDir, recipe, plugins) => {
  const shimmed = recipe.cli === undefined ? {} : Object.fromEntries(Object.entries(SHIMMED).flatMap(([name, file]) => [[name, join(SHIM, file)], [`node:${name}`, join(SHIM, file)]]));
  const external = NODE_BUILTINS.flatMap((name) => [name, `node:${name}`]).filter((name) => !(name in shimmed));
  return {
    entryPoints: [join(projectDir, 'entry.js')],
    absWorkingDir: projectDir,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['main', 'module'],
    conditions: ['require', 'default'],
    external,
    alias: { ...shimmed, ...Object.fromEntries(Object.entries(recipe.alias ?? {}).map(([name, path]) => [name, join(projectDir, 'node_modules', path)])) },
    banner: { js: BANNER },
    plugins: [shebangPlugin, ...plugins],
    minify: true,
    outfile: join(projectDir, 'tool.js'),
    logLevel: 'error',
  };
};

export const writeEntry = async (projectDir, recipe) => {
  const entry = recipe.cli === undefined ? recipe.entry : await cliEntry(projectDir, recipe.cli);
  await writeFile(join(projectDir, 'entry.js'), entry);
};
