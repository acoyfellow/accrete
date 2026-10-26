import { readFileSync } from 'node:fs';

const base = process.env.ACCRETE_URL;
const token = process.env.ACCRETE_TOKEN;
for (const registration of JSON.parse(readFileSync('dist/registrations.json', 'utf8'))) {
  const response = await fetch(`${base}/tools`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(registration),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${registration.name}: ${body.error}`);
  console.log(`registered ${body.name}@${body.version} ${body.hash.slice(0, 12)}`);
}
