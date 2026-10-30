import { sha256 } from './tools';
import type { Env } from './types';

export type SnapshotUpload = {
  readonly engineSha: string;
  readonly toolHashes: Readonly<Record<string, string>>;
  readonly meta: string;
  readonly snapshot: string;
};

export type StoredSnapshot = SnapshotUpload & { readonly snapshotSha: string; readonly key: string; readonly bytes: number; readonly storedAt: string };

const HEX = new RegExp('^[0-9a-f]{64}$');

const MAX_SNAPSHOT_BASE64 = 12 * 1024 * 1024;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isHashRecord = (value: unknown): value is Record<string, string> =>
  isObject(value) && Object.values(value).every((entry) => typeof entry === 'string' && HEX.test(entry));

export const isSnapshotUpload = (value: unknown): value is SnapshotUpload =>
  isObject(value) &&
  typeof value.engineSha === 'string' &&
  HEX.test(value.engineSha) &&
  isHashRecord(value.toolHashes) &&
  typeof value.meta === 'string' &&
  typeof value.snapshot === 'string' &&
  value.snapshot.length <= MAX_SNAPSHOT_BASE64;

const isStored = (value: unknown): value is StoredSnapshot => {
  if (!isObject(value)) return false;
  const { snapshotSha, key, bytes } = value;
  return isSnapshotUpload(value) && typeof snapshotSha === 'string' && typeof key === 'string' && typeof bytes === 'number';
};

const objectKey = (key: string): string => `snapshots/${key}.json`;

const keyOf = (engineSha: string, snapshotSha: string, toolHashes: Readonly<Record<string, string>>): Promise<string> =>
  sha256(JSON.stringify({ engineSha, snapshotSha, tools: Object.entries(toolHashes).sort(([a], [b]) => a.localeCompare(b)) }));

const decodedLength = (base64: string): number => Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);

export const putSnapshot = async (env: Env, upload: SnapshotUpload): Promise<StoredSnapshot> => {
  const snapshotSha = await sha256(upload.snapshot);
  const key = await keyOf(upload.engineSha, snapshotSha, upload.toolHashes);
  const stored: StoredSnapshot = { ...upload, snapshotSha, key, bytes: decodedLength(upload.snapshot), storedAt: new Date().toISOString() };
  await env.TOOLS.put(objectKey(key), JSON.stringify(stored));
  return stored;
};

export const getSnapshot = async (env: Env, key: string): Promise<StoredSnapshot | null> => {
  if (!HEX.test(key)) return null;
  const object = await env.TOOLS.get(objectKey(key));
  if (object === null) return null;
  const value: unknown = await object.json();
  if (!isStored(value)) throw new Error(`snapshot ${key} is malformed`);
  if ((await sha256(value.snapshot)) !== value.snapshotSha) throw new Error(`snapshot ${key} does not match its hash`);
  if ((await keyOf(value.engineSha, value.snapshotSha, value.toolHashes)) !== key) throw new Error(`snapshot ${key} does not match its key`);
  return value;
};
