import { marked } from 'marked';

export const run = async ({ args, files }) => {
  const [source, target] = args;
  const html = await marked.parse(files[source] ?? '', { async: true });
  return target === undefined ? { stdout: html, files: {} } : { stdout: '', files: { [target]: html } };
};
