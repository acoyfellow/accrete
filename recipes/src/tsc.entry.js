import ts from 'typescript';
import types from 'accrete:embed/types';

const MODULES_ROOT = '/node_modules/';
const LIB_ROOT = MODULES_ROOT + 'typescript/lib/';

const normalize = (path) => path.replace(new RegExp('^[.][/]'), '').replace(new RegExp('^[/]+'), '');

const virtualFiles = (files) => {
  const all = new Map();
  for (const [name, text] of Object.entries(types)) all.set(MODULES_ROOT + name, text);
  for (const [name, text] of Object.entries(files)) all.set('/' + normalize(name), text);
  return all;
};

const formatHost = {
  getCanonicalFileName: (name) => name,
  getCurrentDirectory: () => '/',
  getNewLine: () => '\n',
};

const childrenOf = (all, directory) => {
  const prefix = directory.endsWith('/') ? directory : directory + '/';
  const entries = [...all.keys()].filter((name) => name.startsWith(prefix)).map((name) => name.slice(prefix.length));
  return {
    files: entries.filter((entry) => !entry.includes('/')),
    directories: [...new Set(entries.filter((entry) => entry.includes('/')).map((entry) => entry.split('/')[0]))],
  };
};

const systemFor = (all) => ({
  ...ts.sys,
  args: [],
  newLine: '\n',
  useCaseSensitiveFileNames: true,
  getCurrentDirectory: () => '/',
  getExecutingFilePath: () => LIB_ROOT + 'tsc.js',
  fileExists: (path) => all.has(path),
  readFile: (path) => all.get(path),
  directoryExists: (path) => path === '/' || childrenOf(all, path).files.length + childrenOf(all, path).directories.length > 0,
  getDirectories: (path) => childrenOf(all, path).directories,
  readDirectory: (path, extensions, excludes, includes, depth) =>
    ts.matchFiles(path, extensions, excludes, includes, true, '/', depth, (directory) => childrenOf(all, directory), (name) => name),
  realpath: (path) => path,
  write: () => {},
  writeFile: () => {},
});

export const run = async ({ args, files }) => {
  const projectIndex = args.indexOf('-p');
  const project = projectIndex === -1 ? 'tsconfig.json' : args[projectIndex + 1];
  const all = virtualFiles(files);
  const system = systemFor(all);
  const configPath = '/' + normalize(project);
  const config = ts.readConfigFile(configPath, system.readFile);
  if (config.error) return { stdout: ts.formatDiagnostics([config.error], formatHost), files: {} };
  const parsed = ts.parseJsonConfigFileContent(config.config, system, '/', { pretty: false }, configPath);
  const host = ts.createCompilerHost(parsed.options);
  Object.assign(host, {
    fileExists: system.fileExists,
    readFile: system.readFile,
    directoryExists: system.directoryExists,
    getDirectories: system.getDirectories,
    realpath: system.realpath,
    getCurrentDirectory: () => '/',
    getDefaultLibLocation: () => LIB_ROOT,
    getDefaultLibFileName: (options) => LIB_ROOT + ts.getDefaultLibFileName(options),
    writeFile: () => {},
    getSourceFile: (name, languageVersion) => {
      const text = all.get(name);
      return text === undefined ? undefined : ts.createSourceFile(name, text, languageVersion);
    },
  });
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options, host, projectReferences: parsed.projectReferences });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  return { stdout: ts.formatDiagnostics(diagnostics, formatHost), files: {} };
};
