import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const BIN = {
  marked: { bin: 'marked', args: (source) => ['-i', source] },
  yaml2json: { bin: 'js-yaml', args: (source) => [source] },
  json5: { bin: 'json5', args: (source) => ['-s', '2', source] },
};

export const nativeStdout = (tool, source, files) => {
  const spec = BIN[tool];
  if (spec === undefined) throw new Error(`no native command for ${tool}`);
  const directory = mkdtempSync(join(tmpdir(), 'accrete-native-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    return execFileSync(join(process.cwd(), 'node_modules', '.bin', spec.bin), spec.args(source), { cwd: directory, encoding: 'utf8' });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};
