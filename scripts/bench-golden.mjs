import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const natives = join(process.cwd(), 'dist', 'natives', 'node_modules', '.bin');
const tools = JSON.parse(readFileSync('bench/tools.json', 'utf8'));

const runNative = (bin, args, files) => {
  const directory = mkdtempSync(join(tmpdir(), 'accrete-golden-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(directory, path)), { recursive: true });
      writeFileSync(join(directory, path), content);
    }
    const result = spawnSync(join(natives, bin), args, { cwd: directory, encoding: 'utf8' });
    return { stdout: result.stdout, exit: result.status };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
};

const golden = tools.flatMap((tool) =>
  tool.cases.map((one, index) => {
    const { stdout, exit } = runNative(tool.bin, one.args, one.files);
    if (exit !== 0) throw new Error(`${tool.tool} case ${index} exited ${exit}`);
    return { id: `${tool.tool}#${index}`, tool: tool.tool, set: tool.set, stdout, stdoutHash: createHash('sha256').update(stdout).digest('hex') };
  }),
);
const body = JSON.stringify(golden, null, 2);
writeFileSync('bench/golden.json', body);
const heldout = golden.filter((entry) => entry.set === 'heldout');
console.log(`golden: ${golden.length} cases, ${heldout.length} held out, sha256 ${createHash('sha256').update(body).digest('hex').slice(0, 16)}`);
