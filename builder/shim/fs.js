const state = () => globalThis.__accrete;
const ROOT = '/work/';

const normalize = (path) => {
  const text = String(path instanceof URL ? path.pathname : path);
  const absolute = text.startsWith('/') ? text : ROOT + text;
  const parts = [];
  for (const part of absolute.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return '/' + parts.join('/');
};

const relative = (path) => {
  const full = normalize(path) + '/';
  return full.startsWith(ROOT) ? full.slice(ROOT.length, -1) : null;
};

const fail = (code, path) => Object.assign(new Error(`${code}: no such file or directory, '${path}'`), { code, errno: -2, path: String(path), syscall: 'open' });

const isFile = (path) => {
  const key = relative(path);
  return key !== null && key in state().files;
};

const isDirectory = (path) => {
  const key = relative(path);
  if (key === null) return normalize(path) === '/';
  if (key === '') return true;
  return Object.keys(state().files).some((name) => name.startsWith(key + '/'));
};

const exists = (path) => isFile(path) || isDirectory(path);

const fileText = (path) => {
  if (!isFile(path)) throw fail('ENOENT', path);
  return state().files[relative(path)];
};

const encode = (text, options) => {
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? text : Buffer.from(text, 'utf8');
};

const stats = (path) => {
  if (!exists(path)) throw fail('ENOENT', path);
  const file = isFile(path);
  const time = new Date(0);
  return {
    isFile: () => file,
    isDirectory: () => !file,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    size: file ? fileText(path).length : 0,
    mode: file ? 0o100644 : 0o40755,
    mtime: time,
    ctime: time,
    atime: time,
    birthtime: time,
    mtimeMs: 0,
  };
};

const listing = (path) => {
  const key = relative(path);
  const prefix = key === null || key === '' ? '' : key + '/';
  const names = new Set();
  for (const name of Object.keys(state().files)) if (name.startsWith(prefix)) names.add(name.slice(prefix.length).split('/')[0]);
  return [...names].sort();
};

const asText = (data) => (typeof data === 'string' ? data : new TextDecoder().decode(data));

const packageText = (path) => {
  const text = String(path instanceof URL ? path.pathname : path);
  if (!text.endsWith('package.json')) return null;
  const manifests = globalThis.__accreteManifests ?? {};
  const match = Object.keys(manifests).find((name) => text.endsWith(`/${name}/package.json`));
  return match === undefined ? JSON.stringify({ name: 'tool', version: '0.0.0' }) : manifests[match];
};

export const readFileSync = (path, options) => {
  if (path === 0 || path === '/dev/stdin') return encode(state().stdin, options);
  if (!isFile(path)) {
    const manifest = packageText(path);
    if (manifest !== null) return encode(manifest, options);
  }
  return encode(fileText(path), options);
};

const emitter = () => {
  const handlers = {};
  const self = {
    on: (event, handler) => {
      (handlers[event] ??= []).push(handler);
      return self;
    },
    once: (event, handler) => self.on(event, handler),
    emit: (event, ...args) => {
      for (const handler of handlers[event] ?? []) handler(...args);
      return true;
    },
    setEncoding: () => self,
    resume: () => self,
    pause: () => self,
    removeListener: () => self,
    pipe: (target) => {
      self.on('data', (chunk) => target.write(chunk));
      self.on('end', () => target.end?.());
      return target;
    },
  };
  return self;
};

export const createReadStream = (path, options) => {
  const stream = emitter();
  Promise.resolve().then(() => {
    try {
      const text = fileText(path);
      const encoding = typeof options === 'string' ? options : options?.encoding;
      stream.emit('open');
      stream.emit('data', encoding ? text : Buffer.from(text, 'utf8'));
      stream.emit('end');
      stream.emit('close');
    } catch (error) {
      stream.emit('error', error);
    }
  });
  return stream;
};

export const createWriteStream = (path) => {
  const parts = [];
  const stream = emitter();
  stream.write = (chunk) => {
    parts.push(typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk));
    return true;
  };
  stream.end = (chunk) => {
    if (chunk !== undefined) stream.write(chunk);
    writeFileSync(path, parts.join(''));
    stream.emit('finish');
    stream.emit('close');
  };
  return stream;
};
export const writeFileSync = (path, data) => {
  if (path === 1 || path === '/dev/stdout') return void state().out.push(asText(data));
  if (path === 2 || path === '/dev/stderr') return void state().err.push(asText(data));
  const key = relative(path);
  if (key === null || key === '') throw fail('EACCES', path);
  state().files[key] = asText(data);
  state().written.add(key);
};
export const appendFileSync = (path, data) => {
  const before = isFile(path) ? fileText(path) : '';
  writeFileSync(path, before + asText(data));
};
export const existsSync = (path) => exists(path);
export const statSync = (path, options) => {
  if (options?.throwIfNoEntry === false && !exists(path)) return undefined;
  return stats(path);
};
export const lstatSync = statSync;
export const accessSync = (path) => {
  if (!exists(path)) throw fail('ENOENT', path);
};
export const readdirSync = (path, options) => {
  const names = listing(path);
  return options?.withFileTypes ? names.map((name) => ({ name, ...stats(normalize(path) + '/' + name) })) : names;
};
export const mkdirSync = () => undefined;
export const realpathSync = Object.assign((path) => normalize(path), { native: (path) => normalize(path) });
export const unlinkSync = (path) => {
  delete state().files[relative(path)];
};
export const rmSync = unlinkSync;
export const openSync = (path) => path;
export const closeSync = () => undefined;
export const fstatSync = (fd) => stats(fd);
export const writeSync = (fd, data) => {
  writeFileSync(fd, data);
  return String(data).length;
};
export const watch = () => ({ close: () => undefined });
export const constants = { F_OK: 0, R_OK: 4, W_OK: 2, X_OK: 1 };

const later = (work) =>
  new Promise((resolve, reject) => {
    try {
      resolve(work());
    } catch (error) {
      reject(error);
    }
  });

const callback =
  (work) =>
  (...args) => {
    const done = args.pop();
    later(() => work(...args)).then(
      (value) => done(null, value),
      (error) => done(error),
    );
  };

export const promises = {
  readFile: (path, options) => later(() => readFileSync(path, options)),
  writeFile: (path, data) => later(() => writeFileSync(path, data)),
  appendFile: (path, data) => later(() => appendFileSync(path, data)),
  stat: (path) => later(() => stats(path)),
  lstat: (path) => later(() => stats(path)),
  access: (path) => later(() => accessSync(path)),
  readdir: (path, options) => later(() => readdirSync(path, options)),
  mkdir: () => later(() => undefined),
  realpath: (path) => later(() => normalize(path)),
  unlink: (path) => later(() => unlinkSync(path)),
  rm: (path) => later(() => unlinkSync(path)),
};

export const readFile = callback(readFileSync);
export const writeFile = callback(writeFileSync);
export const stat = callback(stats);
export const lstat = callback(stats);
export const access = callback(accessSync);
export const readdir = callback(readdirSync);
export const mkdir = callback(mkdirSync);
export const realpath = callback((path) => normalize(path));

export default {
  readFileSync,
  writeFileSync,
  createReadStream,
  createWriteStream,
  appendFileSync,
  existsSync,
  statSync,
  lstatSync,
  accessSync,
  readdirSync,
  mkdirSync,
  realpathSync,
  unlinkSync,
  rmSync,
  openSync,
  closeSync,
  fstatSync,
  writeSync,
  watch,
  constants,
  promises,
  readFile,
  writeFile,
  stat,
  lstat,
  access,
  readdir,
  mkdir,
  realpath,
  exists: (path, done) => done(exists(path)),
};
