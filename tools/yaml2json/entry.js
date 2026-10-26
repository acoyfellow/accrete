import { load } from 'js-yaml';

export const run = async ({ args, files }) => {
  const [source, target] = args;
  const json = JSON.stringify(load(files[source] ?? ''), null, 2) + '\n';
  return target === undefined ? { stdout: json, files: {} } : { stdout: '', files: { [target]: json } };
};
