import { readFileSync, writeFileSync } from 'node:fs';

const RECEIPT = 'bench/scripts/latest.json';
const sealed = JSON.parse(readFileSync(RECEIPT, 'utf8'));
const lines = (text) => text.split('\n').length;
const out = `export const scriptNumbers = ${JSON.stringify({
  receipt: RECEIPT,
  receiptSha256: sealed.sha256,
  at: sealed.at,
  model: sealed.model,
  name: sealed.script.name,
  source: sealed.script.source,
  sourceLines: lines(sealed.script.source.trim()),
  sourceSha256: sealed.script.sourceSha256,
  modelMs: sealed.script.modelMs,
  firstKeepContainerSeconds: sealed.summary.firstKeepContainerSeconds,
  firstKeepMs: sealed.summary.firstKeepMs,
  repeatMedianMs: sealed.summary.repeatMedianMs,
  repeatCount: sealed.repeats.length,
  repeatContainerSeconds: sealed.summary.repeatContainerSeconds,
  repeatModelTokens: sealed.summary.repeatModelTokens,
  checks: sealed.checks.length,
}, null, 2)} as const;\n`;
writeFileSync('client/src/numbers.ts', out);
console.log(`script numbers from ${RECEIPT}`);
