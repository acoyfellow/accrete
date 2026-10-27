import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { bundleOptions, writeEntry } from '../builder/bundle.mjs';

const tools = JSON.parse(readFileSync('bench/tools.json', 'utf8'));
const golden = JSON.parse(readFileSync('bench/golden.json', 'utf8'));
const only = process.argv[2];
const natives = join(process.cwd(), 'dist', 'natives');
for (const tool of tools.filter((entry) => !only || entry.tool === only)) {
  const projectDir = join(process.cwd(), 'dist', 'try', tool.tool);
  mkdirSync(projectDir, { recursive: true });
  const recipe = { cli: { package: tool.package, bin: tool.bin } };
  await writeEntry(natives, recipe);
  const options = bundleOptions(natives, recipe, []);
  options.outfile = join(projectDir, 'tool.js');
  try {
    await build(options);
  } catch (error) {
    console.log(`BUILD FAIL ${tool.tool}: ${String(error.message).slice(0, 300)}`);
    continue;
  }
  for (const [index, one] of tool.cases.entries()) {
    const id = `${tool.tool}#${index}`;
    const expected = golden.find((entry) => entry.id === id).stdout;
    try {
      const module = await import(`${pathToFileURL(options.outfile).href}?case=${index}`);
      const output = await module.run({ args: one.args, files: one.files });
      console.log(`${output.stdout === expected ? 'PASS' : 'DIFF'} ${id}${output.stdout === expected ? '' : ` got=${JSON.stringify(output.stdout.slice(0, 120))}`}`);
    } catch (error) {
      console.log(`RUN FAIL ${id}: ${String(error.message).slice(0, 300)}`);
    }
  }
}
