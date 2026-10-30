import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile, readFile, readdir, stat, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from '/app/node_modules/esbuild/lib/main.js';
import { BANNER, NODE_BUILTINS, bundleOptions, writeEntry } from './bundle.mjs';

const WORK = '/work';

const exec = (command, args, options) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

const writeTree = async (root, files) => {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
};

const escapeRegExp = (text) => text.replace(/[.+^${}()|[\]\\]/g, (character) => `\\${character}`);

const globToRegExp = (pattern) => new RegExp(`^${escapeRegExp(pattern).replaceAll('**/', '(?:.*/)?').replaceAll('*', '[^/]*')}$`);

const walk = async (directory, prefix = '') => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) found.push(...(await walk(join(directory, entry.name), relative + '/')));
    else found.push(relative);
  }
  return found;
};

const staticRoot = (pattern) => pattern.split('/').filter((part, index, parts) => !parts.slice(0, index + 1).some((piece) => piece.includes('*'))).join('/');

const embedPlugin = (projectDir, embed) => ({
  name: 'accrete-embed',
  setup(builder) {
    builder.onResolve({ filter: new RegExp('^accrete:embed/') }, (args) => ({ path: args.path.slice('accrete:embed/'.length), namespace: 'accrete-embed' }));
    builder.onLoad({ filter: new RegExp('.*'), namespace: 'accrete-embed' }, async (args) => {
      const pattern = embed[args.path];
      if (pattern === undefined) throw new Error(`no embed named ${args.path}`);
      const patterns = Array.isArray(pattern) ? pattern : [pattern];
      const entries = {};
      for (const one of patterns) {
        const root = staticRoot(one);
        const matcher = globToRegExp(one);
        const absoluteRoot = join(projectDir, 'node_modules', root);
        const names = (await stat(absoluteRoot)).isDirectory() ? (await walk(absoluteRoot)).map((name) => `${root}/${name}`) : [root];
        for (const name of names.filter((candidate) => matcher.test(candidate)).sort()) entries[name] = await readFile(join(projectDir, 'node_modules', name), 'utf8');
      }
      return { contents: `export default ${JSON.stringify(entries)};`, loader: 'js' };
    });
  },
});

const FILTERS = {
  raw: (stdout) => stdout,
  'eslint-json': (stdout) =>
    JSON.parse(stdout)
      .flatMap((file) => file.messages.map((message) => `${file.filePath.slice(WORK.length + 1)}:${message.line}:${message.column} ${message.ruleId} ${message.message}`))
      .join('\n') + '\n',
};

const runBuild = async (recipe) => {
  const started = Date.now();
  const id = createHash('sha256').update(JSON.stringify(recipe)).digest('hex').slice(0, 16);
  const projectDir = `/build/${id}`;
  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'accrete-build', private: true, type: 'module' }));
  const specs = Object.entries(recipe.packages).map(([name, version]) => `${name}@${version}`);
  const install = await exec('npm', ['install', '--registry=https://registry.npmjs.org/', '--no-audit', '--no-fund', '--ignore-scripts', ...specs], { cwd: projectDir });
  if (install.code !== 0) throw new Error(`npm install failed: ${install.stderr.slice(-2000)}`);
  const versions = {};
  for (const name of Object.keys(recipe.packages)) {
    versions[name] = JSON.parse(await readFile(join(projectDir, 'node_modules', name, 'package.json'), 'utf8')).version;
  }
  await writeEntry(projectDir, recipe);
  const options = bundleOptions(projectDir, recipe, [embedPlugin(projectDir, recipe.embed ?? {})]);
  const outfile = options.outfile;
  await build(options);
  const bundle = await readFile(outfile, 'utf8');
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  await writeTree(WORK, { ...recipe.check.files, ...(recipe.nativeFiles ?? {}) });
  await symlink(join(projectDir, 'node_modules'), join(WORK, 'node_modules'));
  const nativeBin = recipe.cli === undefined ? recipe.native.bin : recipe.cli.bin;
  const nativeArgs = recipe.cli === undefined ? recipe.native.args : recipe.check.args;
  const native = await exec(join(projectDir, 'node_modules', '.bin', nativeBin), nativeArgs, { cwd: WORK });
  const built = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  const builtOutput = await built.run({ args: recipe.check.args, files: recipe.check.files });
  return {
    code: bundle,
    versions,
    nativeStdout: FILTERS[recipe.nativeFilter ?? 'raw'](native.stdout),
    nativeExit: native.code,
    nativeStderr: native.stderr.slice(-2000),
    builtStdout: builtOutput.stdout,
    match: FILTERS[recipe.nativeFilter ?? 'raw'](native.stdout) === builtOutput.stdout,
    buildSeconds: (Date.now() - started) / 1000,
  };
};

const runScript = async (script) => {
  const started = Date.now();
  const id = createHash('sha256').update(JSON.stringify(script)).digest('hex').slice(0, 16);
  const projectDir = `/build/script-${id}`;
  await rm(projectDir, { recursive: true, force: true });
  await mkdir(projectDir, { recursive: true });
  await writeFile(join(projectDir, 'package.json'), JSON.stringify({ name: 'accrete-script', private: true, type: 'module' }));
  const specs = Object.entries(script.packages ?? {}).map(([name, version]) => `${name}@${version}`);
  if (specs.length > 0) {
    const install = await exec('npm', ['install', '--registry=https://registry.npmjs.org/', '--no-audit', '--no-fund', '--ignore-scripts', ...specs], { cwd: projectDir });
    if (install.code !== 0) throw new Error(`npm install failed: ${install.stderr.slice(-2000)}`);
  }
  await writeFile(join(projectDir, 'entry.js'), script.source);
  const outfile = join(projectDir, 'tool.js');
  await build({
    entryPoints: [join(projectDir, 'entry.js')],
    absWorkingDir: projectDir,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    mainFields: ['module', 'main'],
    external: NODE_BUILTINS.flatMap((name) => [name, `node:${name}`]),
    banner: { js: BANNER },
    minify: true,
    outfile,
    logLevel: 'error',
  });
  const source = await import(pathToFileURL(join(projectDir, 'entry.js')).href + `?t=${Date.now()}`);
  const bundled = await import(pathToFileURL(outfile).href + `?t=${Date.now()}`);
  const input = { args: script.check.args, files: script.check.files };
  const sourceOutput = await source.run(input);
  const bundledOutput = await bundled.run(input);
  return {
    code: await readFile(outfile, 'utf8'),
    sourceStdout: sourceOutput.stdout,
    bundledStdout: bundledOutput.stdout,
    expectedStdout: script.check.stdout,
    match: sourceOutput.stdout === script.check.stdout && bundledOutput.stdout === script.check.stdout,
    buildSeconds: (Date.now() - started) / 1000,
  };
};

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => (body += chunk));
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });

createServer(async (request, response) => {
  const reply = (status, value) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  if (request.method === 'GET' && request.url === '/health') return reply(200, { ok: true });
  if (request.method === 'POST' && request.url === '/build') {
    try {
      return reply(200, { ok: true, result: await runBuild(JSON.parse(await readBody(request))) });
    } catch (error) {
      return reply(200, { ok: false, error: String(error && error.message ? error.message : error) });
    }
  }
  if (request.method === 'POST' && request.url === '/script') {
    try {
      return reply(200, { ok: true, result: await runScript(JSON.parse(await readBody(request))) });
    } catch (error) {
      return reply(200, { ok: false, error: String(error && error.message ? error.message : error) });
    }
  }
  return reply(404, { ok: false, error: 'not found' });
}).listen(8080);
