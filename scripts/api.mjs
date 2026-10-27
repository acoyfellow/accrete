import { readFileSync } from 'node:fs';

const [method, path, bodyFile] = process.argv.slice(2);
const response = await fetch(`${process.env.ACCRETE_URL}${path}`, {
  method,
  headers: { authorization: `Bearer ${process.env.ACCRETE_TOKEN}`, 'content-type': 'application/json' },
  body: bodyFile ? readFileSync(bodyFile, 'utf8') : undefined,
  signal: AbortSignal.timeout(Number(process.env.ACCRETE_FETCH_MS ?? 55_000)),
});
process.stdout.write(JSON.stringify({ status: response.status, body: await response.json() }));
