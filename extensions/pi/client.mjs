import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

const STDOUT_FILE = '__accrete_stdout__';
const NAME_PATTERN = new RegExp('[^a-z0-9-]', 'g');

export const configFromEnv = (env = process.env) => {
  const url = env.ACCRETE_URL ?? '';
  const token = env.ACCRETE_TOKEN ?? '';
  return { url: url.replace(new RegExp('/+$'), ''), token, ready: url.length > 0 && token.length > 0 };
};

const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export const toolId = (pkg, version) => `lift-${pkg}-${version}`.toLowerCase().replace(NAME_PATTERN, '-');

const request = async (config, method, path, body, timeoutMs) => {
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  const parsed = text.length === 0 ? {} : JSON.parse(text);
  if (!response.ok) throw new Error(`accrete ${method} ${path} -> HTTP ${response.status}: ${String(parsed.error ?? text).slice(0, 300)}`);
  return parsed;
};

export const resolveVersion = async (pkg, version) => {
  if (version !== undefined && version !== 'latest' && version.length > 0) return version;
  const response = await fetch(`https://registry.npmjs.org/${pkg}/latest`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`npm registry: no latest version for ${pkg}`);
  const body = await response.json();
  return String(body.version);
};

const readInputs = async (cwd, paths) => {
  const entries = await Promise.all(paths.map(async (path) => [relative(cwd, resolve(cwd, path)), await readFile(resolve(cwd, path), 'utf8')]));
  for (const [path] of entries) if (path.startsWith('..')) throw new Error(`input ${path} is outside the working directory`);
  return Object.fromEntries(entries);
};

const writeOutputs = async (cwd, outputs) => {
  const written = [];
  for (const [path, content] of Object.entries(outputs)) {
    const target = resolve(cwd, path);
    if (relative(cwd, target).startsWith('..')) continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    written.push(path);
  }
  return written;
};

export const knownTools = async (config) => request(config, 'GET', '/tools', undefined, 15_000);

export const lift = async (config, options) => {
  const cwd = options.cwd ?? process.cwd();
  const version = await resolveVersion(options.pkg, options.version);
  const bin = options.bin ?? options.pkg;
  const name = toolId(options.pkg, version);
  const files = await readInputs(cwd, options.inputs ?? []);
  const recipe = {
    name,
    packages: { [options.pkg]: version },
    cli: { package: options.pkg, bin },
    entry: '',
    native: { bin, args: options.args },
    check: { args: options.args, files },
  };
  const started = Date.now();
  await request(config, 'PUT', '/recipes', recipe, 20_000);
  const result = await request(
    config,
    'POST',
    '/task',
    {
      workspace: `lift-${sha256(`${name}:${Date.now()}:${Math.random()}`).slice(0, 16)}`,
      seed: files,
      steps: [{ op: 'tool', name, args: options.args, inputs: Object.keys(files), stdoutTo: STDOUT_FILE }],
    },
    options.timeoutMs ?? 120_000,
  );
  const ms = Date.now() - started;
  const log = (result.logs ?? []).find((entry) => entry.op === 'tool') ?? (result.logs ?? []).at(-1) ?? {};
  const stdout = result.files?.[STDOUT_FILE] ?? '';
  const changed = Object.fromEntries(Object.entries(result.files ?? {}).filter(([path, content]) => path !== STDOUT_FILE && files[path] !== content));
  const written = options.write === false ? [] : await writeOutputs(cwd, changed);
  const receipt = {
    kind: 'accrete-lift',
    at: new Date().toISOString(),
    tool: `${options.pkg}@${version}`,
    toolHash: log.hash ?? null,
    args: options.args,
    inputHash: sha256(JSON.stringify(files)),
    outputHash: sha256(stdout),
    placement: log.placement ?? 'none',
    containerSeconds: log.containerSeconds ?? 0,
    ms,
    ok: result.ok === true,
    error: result.ok === true ? undefined : String(log.error ?? 'failed').slice(0, 400),
  };
  if (options.receiptsDir !== undefined) {
    await mkdir(options.receiptsDir, { recursive: true });
    await appendFile(join(options.receiptsDir, 'receipts.jsonl'), `${JSON.stringify(receipt)}\n`);
  }
  return { ...receipt, stdout, written };
};
