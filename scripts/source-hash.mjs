import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from './receipt.mjs';

const ROOTS = ['src', 'builder', 'bench/tools.json', 'bench/golden.json'];
const SKIP = new Set(['src/self-source.ts']);

const files = (path) => (statSync(path).isDirectory() ? readdirSync(path).sort().flatMap((name) => files(join(path, name))) : [path]);

export const sourceFiles = () => ROOTS.flatMap(files).filter((path) => !SKIP.has(path));

export const sourceHash = () => sha256(sourceFiles().map((path) => `${path}\n${sha256(readFileSync(path, 'utf8'))}`).join('\n'));
