import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const GENERATED = 'src/self-source.ts';
const STUB = 'export const selfSource: Readonly<Record<string, string>> = {};\n';
const MODEL_DIRECTORY = 'src/domain';
const MODEL_BOUNDARY = ['src/domain/decide.ts', 'src/domain/book.ts'];
const CLIENT_DATA = ['client/src/numbers.ts'];

const workerSources = () =>
  readdirSync('src')
    .filter((name) => name.endsWith('.ts'))
    .sort()
    .map((name) => join('src', name))
    .filter((path) => path !== GENERATED);

const declarationPath = (path) => path.replace(/\.ts$/, '.d.ts');

const boundaryDeclarations = () => {
  const emitted = {};
  const program = ts.createProgram(MODEL_BOUNDARY, {
    declaration: true,
    emitDeclarationOnly: true,
    strict: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: ['@cloudflare/workers-types'],
  });
  for (const path of MODEL_BOUNDARY) {
    const source = program.getSourceFile(path);
    program.emit(source, (_, text) => {
      emitted[declarationPath(path)] = text;
    }, undefined, true);
  }
  return emitted;
};

const modelCommandTypes = () =>
  'export type RequestBuild = unknown;\nexport type RecordBuilt = unknown;\nexport type RecordFailed = unknown;\nexport type Register = unknown;\nexport type Forget = unknown;\n';

export const selfSeed = () => {
  const sources = workerSources();
  const data = ['status.json', ...readdirSync('recipes').filter((name) => name.endsWith('.json')).sort().map((name) => join('recipes', name))];
  const seed = Object.fromEntries([...sources, ...data, ...CLIENT_DATA, 'tsconfig.json'].map((path) => [path, readFileSync(path, 'utf8')]));
  const model = { ...boundaryDeclarations(), [`${MODEL_DIRECTORY}/tool.d.ts`]: modelCommandTypes() };
  return { seed: { ...seed, ...model, [GENERATED]: STUB }, sources: [...sources, GENERATED] };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { seed, sources } = selfSeed();
  writeFileSync(GENERATED, `export const selfSource: Readonly<Record<string, string>> = ${JSON.stringify(seed, null, 2)};\n`);
  console.log(`self-source: ${sources.length} source files, model boundary as declarations: ${MODEL_BOUNDARY.join(', ')}`);
}
