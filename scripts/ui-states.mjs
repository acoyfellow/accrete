import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const out = join(mkdtempSync(join(tmpdir(), 'ui-states-')), 'run.mjs');
execFileSync('node_modules/.bin/esbuild', ['scripts/ui-states.entry.ts', '--bundle', '--platform=node', '--format=esm', `--outfile=${out}`, '--log-level=error'], { stdio: 'inherit' });
execFileSync('node', [out], { stdio: 'inherit' });
