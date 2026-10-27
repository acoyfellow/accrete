import { readFileSync, writeFileSync } from 'node:fs';

const source = (name) => readFileSync(`recipes/src/${name}`, 'utf8');
const write = (name, recipe) => writeFileSync(`recipes/${name}.json`, JSON.stringify(recipe, null, 2) + '\n');

const tsconfig = JSON.stringify({
  compilerOptions: { strict: true, noEmit: true, target: 'es2022', module: 'es2022', moduleResolution: 'bundler', lib: ['es2022'], types: ['@cloudflare/workers-types'], skipLibCheck: true },
  include: ['src'],
});

write('tsc', {
  name: 'tsc',
  packages: { typescript: '5.9.3', '@cloudflare/workers-types': '5.20261026.1', '@cloudflare/containers': '0.3.7' },
  embed: {
    types: [
      'typescript/lib/lib.*.d.ts',
      '@cloudflare/workers-types/*.d.ts',
      '@cloudflare/workers-types/package.json',
      '@cloudflare/containers/package.json',
      '@cloudflare/containers/dist/**/*.d.ts',
    ],
  },
  entry: source('tsc.entry.js'),
  native: { bin: 'tsc', args: ['-p', 'tsconfig.json', '--pretty', 'false'] },
  check: {
    args: ['-p', 'tsconfig.json'],
    files: {
      'tsconfig.json': tsconfig,
      'src/a.ts': 'export const total = (values: number[]): number => values.reduce((sum, value) => sum + value, 0);\nexport const wrong: number = total([1, 2]) + "x";\nexport const handler = { fetch: (request: Request): Response => new Response(request.url) };\n',
      'src/b.ts': 'import { total } from "./a";\nexport const missing = total(["no"]);\n',
      'src/c.ts': 'import { Container } from "@cloudflare/containers";\nexport class Box extends Container { defaultPort = 8080; stopNow(): Promise<void> { return this.destroy(); } }\nconst box: Box | undefined = undefined;\nexport const bad: string | undefined = box?.defaultPort;\n',
    },
  },
});

write('eslint', {
  name: 'eslint',
  packages: { eslint: '10.13.0', '@eslint/js': '10.0.1', '@typescript-eslint/parser': '8.72.0' },
  alias: { 'accrete-eslint-rules': 'eslint/lib/rules/index.js' },
  entry: source('eslint.entry.js'),
  native: { bin: 'eslint', args: ['-f', 'json', 'src/a.ts', 'src/b.js'] },
  nativeFilter: 'eslint-json',
  nativeFiles: { 'eslint.config.mjs': source('eslint.config.mjs') },
  check: {
    args: ['src/a.ts', 'src/b.js'],
    files: {
      'src/a.ts': 'export const f = (x: number): number => {\n  if (x == x) debugger;\n  return x;\n};\n',
      'src/b.js': 'const o = { a: 1, a: 2 };\nexport default o;\n',
    },
  },
});
