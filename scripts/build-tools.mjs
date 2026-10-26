import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const manifest = JSON.parse(readFileSync('tools/manifest.json', 'utf8'));
const versionOf = (pkg) => JSON.parse(readFileSync(`node_modules/${pkg}/package.json`, 'utf8')).version;

mkdirSync('dist/tools', { recursive: true });
const registrations = [];
for (const tool of manifest) {
  const outfile = `dist/tools/${tool.name}.js`;
  await build({ entryPoints: [`tools/${tool.name}/entry.js`], bundle: true, format: 'esm', platform: 'neutral', outfile, minify: true, logLevel: 'error' });
  const native = await import(pathToFileURL(`${process.cwd()}/tools/${tool.name}/entry.js`).href);
  const { stdout } = await native.run({ args: tool.check.args, files: tool.check.files });
  registrations.push({ name: tool.name, version: versionOf(tool.package), code: readFileSync(outfile, 'utf8'), check: { ...tool.check, stdout } });
}
writeFileSync('dist/registrations.json', JSON.stringify(registrations));
console.log(registrations.map((r) => `${r.name}@${r.version} ${r.code.length}B`).join('\n'));
