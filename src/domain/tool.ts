import * as Domain from '@alchemy.run/domain';
import * as Schema from 'effect/Schema';

export const STALE_BUILD_MS = 5 * 60_000;

export class BuildStarted extends Domain.Event('BuildStarted', { by: Schema.String, at: Schema.Int }) {}

export class Built extends Domain.Event('Built', { hash: Schema.String, version: Schema.String }) {}

export class BuildFailed extends Domain.Event('BuildFailed', { reason: Schema.String }) {}

export class Registered extends Domain.Event('Registered', { hash: Schema.String, version: Schema.String }) {}

export class Forgotten extends Domain.Event('Forgotten', {}) {}

export class AlreadyBuilt extends Domain.Rejection('AlreadyBuilt', { hash: Schema.String }) {}

export class AlreadyBuilding extends Domain.Rejection('AlreadyBuilding', { by: Schema.String }) {}

export class NotBuilding extends Domain.Rejection('NotBuilding', {}) {}

export class NotYourBuild extends Domain.Rejection('NotYourBuild', { by: Schema.String }) {}

export class DoesNotMatchRealTool extends Domain.Rejection('DoesNotMatchRealTool', { reason: Schema.String }) {}

export class NothingToForget extends Domain.Rejection('NothingToForget', {}) {}

const Check = {
  nativeMatchesBundle: Schema.Boolean,
  isolateMatchesNative: Schema.Boolean,
};

export class RequestBuild extends Domain.Command('RequestBuild', {
  target: Schema.String,
  input: { by: Schema.String, at: Schema.Int },
  events: [BuildStarted],
  rejects: [AlreadyBuilt, AlreadyBuilding],
}) {}

export class RecordBuilt extends Domain.Command('RecordBuilt', {
  target: Schema.String,
  input: { by: Schema.String, hash: Schema.String, version: Schema.String, ...Check },
  events: [Built],
  rejects: [NotBuilding, NotYourBuild, DoesNotMatchRealTool],
}) {}

export class RecordFailed extends Domain.Command('RecordFailed', {
  target: Schema.String,
  input: { by: Schema.String, reason: Schema.String },
  events: [BuildFailed],
  rejects: [NotBuilding, NotYourBuild],
}) {}

export class Register extends Domain.Command('Register', {
  target: Schema.String,
  input: { hash: Schema.String, version: Schema.String, isolateMatchesExpected: Schema.Boolean },
  events: [Registered],
  rejects: [AlreadyBuilding, DoesNotMatchRealTool],
}) {}

export class Forget extends Domain.Command('Forget', {
  target: Schema.String,
  input: {},
  events: [Forgotten],
  rejects: [NothingToForget],
}) {}

const ToolState = Schema.Struct({
  status: Schema.Literals(['missing', 'building', 'built']),
  builder: Schema.String,
  startedAt: Schema.Int,
  hash: Schema.String,
  version: Schema.String,
});

type ToolState = typeof ToolState.Type;

const EMPTY: ToolState = { status: 'missing', builder: '', startedAt: 0, hash: '', version: '' };

const buildInFlight = (tool: ToolState, now: number): boolean =>
  tool.status === 'building' && now - tool.startedAt < STALE_BUILD_MS;

type Checks = {
  readonly nativeMatchesBundle: boolean;
  readonly isolateMatchesNative: boolean;
};

const mismatch = (checks: Checks): string | null => {
  if (!checks.nativeMatchesBundle) return 'bundle differs from the native tool';
  if (!checks.isolateMatchesNative) return 'isolate differs from the native tool';
  return null;
};

const FAILED_CHECK = 'isolate differs from the expected output';

const building = (by: string, at: number): ToolState => ({
  ...EMPTY,
  status: 'building',
  builder: by,
  startedAt: at,
});

const built = (hash: string, version: string): ToolState => ({
  ...EMPTY,
  status: 'built',
  hash,
  version,
});

export class Tool extends Domain.Aggregate('Tool', {
  id: Schema.String,
  state: ToolState,
  initial: EMPTY,
  commands: [RequestBuild, RecordBuilt, RecordFailed, Register, Forget],
  decide: {
    RequestBuild: (tool, ask) => {
      if (tool.status === 'built') {
        return new AlreadyBuilt({ hash: tool.hash });
      }
      if (buildInFlight(tool, ask.at)) {
        return new AlreadyBuilding({ by: tool.builder });
      }
      return [new BuildStarted({ by: ask.by, at: ask.at })];
    },
    RecordBuilt: (tool, result) => {
      if (tool.status !== 'building') {
        return new NotBuilding({});
      }
      if (tool.builder !== result.by) {
        return new NotYourBuild({ by: tool.builder });
      }
      const reason = mismatch(result);
      if (reason !== null) {
        return new DoesNotMatchRealTool({ reason });
      }
      return [new Built({ hash: result.hash, version: result.version })];
    },
    RecordFailed: (tool, failure) => {
      if (tool.status !== 'building') {
        return new NotBuilding({});
      }
      if (tool.builder !== failure.by) {
        return new NotYourBuild({ by: tool.builder });
      }
      return [new BuildFailed({ reason: failure.reason })];
    },
    Register: (tool, kept) => {
      if (tool.status === 'building') {
        return new AlreadyBuilding({ by: tool.builder });
      }
      if (!kept.isolateMatchesExpected) {
        return new DoesNotMatchRealTool({ reason: FAILED_CHECK });
      }
      return [new Registered({ hash: kept.hash, version: kept.version })];
    },
    Forget: (tool) => {
      if (tool.status === 'missing') {
        return new NothingToForget({});
      }
      return [new Forgotten({})];
    },
  },
  evolve: {
    BuildStarted: (_, event) => building(event.by, event.at),
    Built: (_, event) => built(event.hash, event.version),
    BuildFailed: () => EMPTY,
    Registered: (_, event) => built(event.hash, event.version),
    Forgotten: () => EMPTY,
  },
}) {}

export class Accrete extends Domain.Model('Accrete', { aggregates: [Tool] }) {}
