import type { ToolRecord } from '../types';
import { type Decision, decideTool, MISSING, type ToolState } from './decide';
import { Forget, RecordBuilt, RecordFailed, Register, RequestBuild } from './tool';

export type ToolStore = {
  readonly readState: (name: string) => ToolState | null;
  readonly writeState: (name: string, state: ToolState) => void;
  readonly latest: (name: string) => ToolRecord | null;
  readonly addRecord: (record: ToolRecord) => void;
  readonly removeRecords: (name: string) => number;
};

export type BuildChecks = { readonly nativeMatchesBundle: boolean; readonly isolateMatchesNative: boolean };

const stateOf = (store: ToolStore, name: string): ToolState => {
  const saved = store.readState(name);
  if (saved !== null) return saved;
  const record = store.latest(name);
  return record === null ? MISSING : { ...MISSING, status: 'built', hash: record.hash, version: record.version };
};

const apply = (store: ToolStore, name: string, decision: Decision): Decision => {
  if (decision.accepted) store.writeState(name, decision.state);
  return decision;
};

export const requestBuild = (store: ToolStore, name: string, by: string, now: number): Decision =>
  apply(store, name, decideTool(name, stateOf(store, name), new RequestBuild({ by, at: now }), now));

export const recordBuilt = (store: ToolStore, record: ToolRecord, by: string, checks: BuildChecks, now: number): Decision => {
  const decision = decideTool(record.name, stateOf(store, record.name), new RecordBuilt({ by, hash: record.hash, version: record.version, ...checks }), now);
  if (decision.accepted) store.addRecord(record);
  return apply(store, record.name, decision);
};

export const recordFailed = (store: ToolStore, name: string, by: string, reason: string, now: number): Decision =>
  apply(store, name, decideTool(name, stateOf(store, name), new RecordFailed({ by, reason }), now));

export const register = (store: ToolStore, record: ToolRecord, isolateMatchesExpected: boolean, now: number): Decision => {
  const decision = decideTool(record.name, stateOf(store, record.name), new Register({ hash: record.hash, version: record.version, isolateMatchesExpected }), now);
  if (decision.accepted) store.addRecord(record);
  return apply(store, record.name, decision);
};

export const forget = (store: ToolStore, name: string, now: number): { readonly decision: Decision; readonly removed: number } => {
  const decision = decideTool(name, stateOf(store, name), new Forget({}), now);
  const removed = decision.accepted ? store.removeRecords(name) : 0;
  return { decision: apply(store, name, decision), removed };
};
