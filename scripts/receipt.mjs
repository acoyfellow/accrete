import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

export const gitDirty = () => execFileSync('git', ['status', '--porcelain', '--', 'src', 'builder', 'scripts', 'bench', 'recipes'], { encoding: 'utf8' }).trim() !== '';

export const placementOf = (url) => (new URL(url).hostname === 'localhost' || new URL(url).hostname === '127.0.0.1' ? 'local' : 'remote');

export const seal = (body) => {
  const { digest: _ignored, ...rest } = body;
  return { ...rest, digest: sha256(canonical(rest)) };
};

export const verifySeal = (receipt) => {
  const { digest, ...rest } = receipt;
  return typeof digest === 'string' && digest === sha256(canonical(rest));
};

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
