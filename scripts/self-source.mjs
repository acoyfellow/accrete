import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GENERATED = 'src/self-source.ts';
const STUB = 'export const selfSource: Readonly<Record<string, string>> = {};\n';

export const selfSeed = () => {
  const sources = readdirSync('src').filter((name) => name.endsWith('.ts')).sort().map((name) => join('src', name)).filter((path) => path !== GENERATED);
  const data = ['status.json', ...readdirSync('recipes').filter((name) => name.endsWith('.json')).sort().map((name) => join('recipes', name))];
  const seed = Object.fromEntries([...sources, ...data, 'tsconfig.json'].map((path) => [path, readFileSync(path, 'utf8')]));
  return { seed: { ...seed, [GENERATED]: STUB }, sources: [...sources, GENERATED] };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const { seed, sources } = selfSeed();
  writeFileSync(GENERATED, `export const selfSource: Readonly<Record<string, string>> = ${JSON.stringify(seed, null, 2)};\n`);
  console.log(`self-source: ${sources.length} source files`);
}
