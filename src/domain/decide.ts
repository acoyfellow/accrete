import * as Aggregate from '@alchemy.run/domain/Aggregate';
import * as DateTime from 'effect/DateTime';
import { type Forget, type RecordBuilt, type RecordFailed, type Register, type RequestBuild, Tool } from './tool';

export type ToolCommand = RequestBuild | RecordBuilt | RecordFailed | Register | Forget;

export type ToolStatus = 'missing' | 'building' | 'built';

export type ToolState = {
  readonly status: ToolStatus;
  readonly builder: string;
  readonly startedAt: number;
  readonly hash: string;
  readonly version: string;
};

export const MISSING: ToolState = { status: 'missing', builder: '', startedAt: 0, hash: '', version: '' };

export type Accepted = { readonly accepted: true; readonly events: readonly string[]; readonly state: ToolState };

export type Rejected = { readonly accepted: false; readonly rejection: string; readonly detail: Readonly<Record<string, unknown>> };

export type Decision = Accepted | Rejected;

export const rejectionOf = (decision: Decision): Rejected | null => (decision.accepted ? null : decision);

const isToolState = (value: unknown): value is ToolState =>
  typeof value === 'object' &&
  value !== null &&
  'status' in value &&
  (value.status === 'missing' || value.status === 'building' || value.status === 'built') &&
  'builder' in value &&
  typeof value.builder === 'string' &&
  'startedAt' in value &&
  typeof value.startedAt === 'number' &&
  'hash' in value &&
  typeof value.hash === 'string' &&
  'version' in value &&
  typeof value.version === 'string';

export const parseToolState = (json: string): ToolState => {
  const value: unknown = JSON.parse(json);
  if (!isToolState(value)) throw new Error('corrupt tool state');
  return value;
};

const detailOf = (rejection: { readonly _tag: string }): Record<string, unknown> =>
  Object.fromEntries(Object.entries(rejection).filter(([key]) => key !== '_tag'));

export const decideTool = (name: string, state: ToolState, command: ToolCommand, now: number): Decision => {
  const prediction = Aggregate.predict(Tool, state, command, { id: name, now: DateTime.makeUnsafe(now) });
  switch (prediction._tag) {
    case 'Accepted': {
      if (!isToolState(prediction.state)) throw new Error(`tool ${name} produced a malformed state`);
      return { accepted: true, events: prediction.events.map((event) => event._tag), state: prediction.state };
    }
    case 'Rejected':
      return { accepted: false, rejection: prediction.rejection._tag, detail: detailOf(prediction.rejection) };
    case 'Unpredictable':
      throw new Error(`tool ${name} could not decide ${command._tag}`);
  }
};
