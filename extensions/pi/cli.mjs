#!/usr/bin/env node
import { configFromEnv, lift } from './client.mjs';

const usage = 'usage: accrete <package>[@version] [args...] [--input <file>]... [--bin <name>] [--no-write]';

const parseSpec = (spec) => {
  const at = spec.lastIndexOf('@');
  return at > 0 ? { pkg: spec.slice(0, at), version: spec.slice(at + 1) } : { pkg: spec, version: undefined };
};

const parseArgs = (argv) => {
  const [spec, ...rest] = argv;
  if (spec === undefined || spec === '--help') return null;
  const options = { ...parseSpec(spec), args: [], inputs: [], bin: undefined, write: true };
  for (let index = 0; index < rest.length; index += 1) {
    const value = rest[index];
    if (value === '--input') options.inputs.push(rest[(index += 1)]);
    else if (value === '--bin') options.bin = rest[(index += 1)];
    else if (value === '--no-write') options.write = false;
    else options.args.push(value);
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));
if (options === null) {
  console.error(usage);
  process.exit(2);
}
const config = configFromEnv();
if (!config.ready) {
  console.error('set ACCRETE_URL and ACCRETE_TOKEN');
  process.exit(2);
}
const result = await lift(config, options);
process.stdout.write(result.stdout);
console.error(`[accrete] ${result.tool} · ${result.placement} · ${result.ms} ms · ${result.containerSeconds.toFixed(2)} container-s${result.written.length ? ` · wrote ${result.written.join(', ')}` : ''}`);
if (!result.ok) {
  console.error(`[accrete] ${result.error}`);
  process.exit(1);
}
