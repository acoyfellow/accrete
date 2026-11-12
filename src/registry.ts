import { DurableObject } from 'cloudflare:workers';
import { type BuildChecks, forget, recordBuilt, recordFailed, register, requestBuild, type ToolStore } from './domain/book';
import { type Decision, parseToolState, type ToolState } from './domain/decide';
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
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS tool_state (name TEXT PRIMARY KEY, state_json TEXT NOT NULL)');
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
    return names.reduce((removed, name) => removed + forget(this.store, name, Date.now()).removed, 0);
  }

  requestBuild(name: string, by: string): Decision {
    return requestBuild(this.store, name, by, Date.now());
  }

  recordBuilt(record: ToolRecord, by: string, checks: BuildChecks): Decision {
    return recordBuilt(this.store, record, by, checks, Date.now());
  }

  recordFailed(name: string, by: string, reason: string): Decision {
    return recordFailed(this.store, name, by, reason, Date.now());
  }

  register(record: ToolRecord, isolateMatchesExpected: boolean): Decision {
    return register(this.store, record, isolateMatchesExpected, Date.now());
  }

  private get store(): ToolStore {
    return {
      readState: (name) => this.readState(name),
      writeState: (name, state) => this.writeState(name, state),
      latest: (name) => this.latest(name),
      addRecord: (record) => this.addRecord(record),
      removeRecords: (name) => this.ctx.storage.sql.exec('DELETE FROM tools WHERE name = ?', name).rowsWritten,
    };
  }

  private readState(name: string): ToolState | null {
    const row = this.ctx.storage.sql.exec<{ state_json: string }>('SELECT state_json FROM tool_state WHERE name = ?', name).toArray()[0];
    return row === undefined ? null : parseToolState(row.state_json);
  }

  private writeState(name: string, state: ToolState): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO tool_state (name, state_json) VALUES (?, ?)', name, JSON.stringify(state));
  }

  private addRecord(record: ToolRecord): void {
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
