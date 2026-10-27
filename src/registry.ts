import { DurableObject } from 'cloudflare:workers';
import type { Env, ToolCheck, ToolKind, ToolRecord } from './types';

type ToolRow = {
  name: string;
  version: string;
  hash: string;
  kind: string;
  check_json: string;
  registered_at: string;
};

const isToolKind = (value: string): value is ToolKind => value === 'esm' || value === 'cli' || value === 'wasi' || value === 'container-only';

const isToolCheck = (value: unknown): value is ToolCheck =>
  typeof value === 'object' &&
  value !== null &&
  'args' in value &&
  Array.isArray(value.args) &&
  value.args.every((entry: unknown) => typeof entry === 'string') &&
  'files' in value &&
  typeof value.files === 'object' &&
  value.files !== null &&
  'stdout' in value &&
  typeof value.stdout === 'string';

const recordOf = (row: ToolRow): ToolRecord => {
  const check: unknown = JSON.parse(row.check_json);
  if (!isToolKind(row.kind) || !isToolCheck(check)) throw new Error(`corrupt registry row for ${row.name}`);
  return { name: row.name, version: row.version, hash: row.hash, kind: row.kind, check, registeredAt: row.registered_at };
};

export class Registry extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS tools (name TEXT NOT NULL, version TEXT NOT NULL, hash TEXT NOT NULL, kind TEXT NOT NULL, check_json TEXT NOT NULL, registered_at TEXT NOT NULL, PRIMARY KEY (name, hash))',
    );
  }

  latest(name: string): ToolRecord | null {
    const row = this.ctx.storage.sql
      .exec<ToolRow>('SELECT * FROM tools WHERE name = ? ORDER BY registered_at DESC LIMIT 1', name)
      .toArray()[0];
    return row === undefined ? null : recordOf(row);
  }

  list(): ToolRecord[] {
    return this.ctx.storage.sql.exec<ToolRow>('SELECT * FROM tools ORDER BY name, registered_at').toArray().map(recordOf);
  }

  forget(names: readonly string[]): number {
    let removed = 0;
    for (const name of names) removed += this.ctx.storage.sql.exec('DELETE FROM tools WHERE name = ?', name).rowsWritten;
    return removed;
  }

  add(record: ToolRecord): void {
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO tools (name, version, hash, kind, check_json, registered_at) VALUES (?, ?, ?, ?, ?, ?)',
      record.name,
      record.version,
      record.hash,
      record.kind,
      JSON.stringify(record.check),
      record.registeredAt,
    );
  }
}
