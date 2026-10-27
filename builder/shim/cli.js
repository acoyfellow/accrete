import { format } from 'node:util';

class Exit extends Error {
  constructor(code) {
    super(`exit ${code}`);
    this.exitCode = code;
  }
}

const settle = async (state) => {
  let quiet = 0;
  let last = -1;
  for (let tick = 0; tick < 4000 && state.exit === null; tick += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const size = state.out.length + state.err.length + state.written.size;
    quiet = size === last ? quiet + 1 : 0;
    last = size;
    if (quiet >= 40) break;
  }
};

const patch = (target, key, value) => {
  try {
    Object.defineProperty(target, key, { value, configurable: true, writable: true });
  } catch {
    target[key] = value;
  }
};

const stream = (sink) => ({
  write: (chunk, encoding, done) => {
    sink.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    if (typeof encoding === 'function') encoding();
    if (typeof done === 'function') done();
    return true;
  },
  end: () => undefined,
  on: () => undefined,
  once: () => undefined,
  removeListener: () => undefined,
  isTTY: false,
  columns: 80,
  fd: 1,
});

export const runCli = async ({ args, files }, load, manifests) => {
  globalThis.__accreteManifests = manifests;
  const state = { files: { ...files }, written: new Set(), out: [], err: [], exit: null, stdin: '' };
  globalThis.__accrete = state;
  const proc = globalThis.process;
  const saved = ['argv', 'cwd', 'chdir', 'stdout', 'stderr', 'stdin', 'exit', 'exitCode', 'env'].map((key) => [proc, key, proc[key]]);
  const savedConsole = ['log', 'info', 'error', 'warn'].map((key) => [console, key, console[key]]);
  patch(proc, 'argv', ['/usr/local/bin/node', '/tool', ...args]);
  patch(proc, 'cwd', () => '/work');
  patch(proc, 'chdir', () => undefined);
  patch(proc, 'stdout', stream(state.out));
  patch(proc, 'stderr', stream(state.err));
  patch(proc, 'stdin', { isTTY: true, on: () => undefined, once: () => undefined, setEncoding: () => undefined, resume: () => undefined, fd: 0 });
  patch(proc, 'exit', (code) => {
    if (state.exit === null) state.exit = code ?? proc.exitCode ?? 0;
    throw new Exit(state.exit);
  });
  patch(proc, 'exitCode', undefined);
  patch(proc, 'env', { ...proc.env, NO_COLOR: '1', FORCE_COLOR: '0', TERM: 'dumb' });
  const line =
    (sink) =>
    (...parts) =>
      sink.push(`${format(...parts)}\n`);
  patch(console, 'log', line(state.out));
  patch(console, 'info', line(state.out));
  patch(console, 'error', line(state.err));
  patch(console, 'warn', line(state.err));
  patch(console.log, 'bind', () => line(state.out));
  const swallow = (error) => {
    if (error instanceof Exit || error?.exitCode !== undefined) return;
    state.err.push(String(error?.stack ?? error));
    if (state.exit === null) state.exit = 1;
  };
  const onRejection = (error) => swallow(error);
  const listen = typeof proc.on === 'function' && typeof proc.off === 'function';
  if (listen) proc.on('unhandledRejection', onRejection);
  try {
    await load();
  } catch (error) {
    swallow(error);
  }
  await settle(state);
  if (listen) proc.off('unhandledRejection', onRejection);
  for (const [target, key, value] of [...saved, ...savedConsole]) patch(target, key, value);
  const exit = state.exit ?? proc.exitCode ?? 0;
  const written = Object.fromEntries([...state.written].map((name) => [name, state.files[name]]));
  if (exit !== 0) throw new Error(`exit ${exit}: ${state.err.join('').slice(0, 800)}`);
  return { stdout: state.out.join(''), files: written };
};
