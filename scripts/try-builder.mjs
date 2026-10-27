import { readFileSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:18187';
const names = process.argv.slice(3);

for (const name of names) {
  const response = await fetch(`${base}/build`, { method: 'POST', body: readFileSync(`recipes/${name}.json`, 'utf8') });
  const body = await response.json();
  if (!body.ok) {
    console.log(`${name} ERR ${body.error.slice(0, 800)}`);
    continue;
  }
  const result = body.result;
  console.log(`${name} match=${result.match} exit=${result.nativeExit} bytes=${result.code.length} seconds=${result.buildSeconds}`);
  if (!result.match) {
    console.log(`  native: ${JSON.stringify(result.nativeStdout.slice(0, 600))}`);
    console.log(`  built : ${JSON.stringify(result.builtStdout.slice(0, 600))}`);
    console.log(`  stderr: ${result.nativeStderr.slice(0, 400)}`);
  }
}
