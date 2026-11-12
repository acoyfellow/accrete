import { Story } from '@alchemy.run/domain/Story';
import { it } from '@effect/vitest';
import {
  Accrete,
  AlreadyBuilding,
  AlreadyBuilt,
  BuildFailed,
  BuildStarted,
  Built,
  DoesNotMatchRealTool,
  Forget,
  Forgotten,
  NotBuilding,
  NothingToForget,
  NotYourBuild,
  RecordBuilt,
  RecordFailed,
  Register,
  Registered,
  RequestBuild,
  STALE_BUILD_MS,
  Tool,
} from '../../src/domain/tool';

const story = Story.make(Accrete, {});
const sass = Tool.ref('sass');
const started = new BuildStarted({ by: 'agent-a', at: 0 });
const passing = { nativeMatchesBundle: true, isolateMatchesNative: true };

it.effect('a new tool: the first agent to ask starts a build', () =>
  story(Story.when(sass, new RequestBuild({ by: 'agent-a', at: 0 })), Story.then(sass, started)),
);

it.effect('a second agent waits while sass builds', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new RequestBuild({ by: 'agent-b', at: 1_000 })),
    Story.rejected(new AlreadyBuilding({ by: 'agent-a' })),
  ),
);

it.effect('sass is built: the next agent is pointed at the copy that exists', () =>
  story(
    Story.given(sass, started, new Built({ hash: 'abc', version: 'sass@1.0.0' })),
    Story.when(sass, new RequestBuild({ by: 'agent-b', at: 2_000 })),
    Story.rejected(new AlreadyBuilt({ hash: 'abc' })),
  ),
);

it.effect('a build hung past the timeout: the next agent takes it over', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new RequestBuild({ by: 'agent-b', at: STALE_BUILD_MS })),
    Story.then(sass, new BuildStarted({ by: 'agent-b', at: STALE_BUILD_MS })),
  ),
);

it.effect('the builder reports a bundle that matches the real tool: it is kept', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new RecordBuilt({ by: 'agent-a', hash: 'abc', version: 'sass@1.0.0', ...passing })),
    Story.then(sass, new Built({ hash: 'abc', version: 'sass@1.0.0' })),
  ),
);

it.effect('the bundle prints something different from the real tool: it is not kept', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new RecordBuilt({ by: 'agent-a', hash: 'bad', version: 'sass@1.0.0', nativeMatchesBundle: false, isolateMatchesNative: true })),
    Story.rejected(new DoesNotMatchRealTool({ reason: 'bundle differs from the native tool' })),
  ),
);

it.effect('the bundle works in the container but not in the isolate: it is not kept', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new RecordBuilt({ by: 'agent-a', hash: 'bad', version: 'sass@1.0.0', nativeMatchesBundle: true, isolateMatchesNative: false })),
    Story.rejected(new DoesNotMatchRealTool({ reason: 'isolate differs from the native tool' })),
  ),
);

it.effect('a hung builder wakes up after another agent took over: its result is refused', () =>
  story(
    Story.given(sass, started, new BuildStarted({ by: 'agent-b', at: STALE_BUILD_MS })),
    Story.when(sass, new RecordBuilt({ by: 'agent-a', hash: 'late', version: 'sass@1.0.0', ...passing })),
    Story.rejected(new NotYourBuild({ by: 'agent-b' })),
  ),
);

it.effect('a result arrives when nobody is building: it is refused', () =>
  story(
    Story.when(sass, new RecordBuilt({ by: 'agent-a', hash: 'abc', version: 'sass@1.0.0', ...passing })),
    Story.rejected(new NotBuilding({})),
  ),
);

it.effect('a build crashes: that is recorded and the next agent can try again', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new RecordFailed({ by: 'agent-a', reason: 'container exited 137' })),
    Story.then(sass, new BuildFailed({ reason: 'container exited 137' })),
  ),
);

it.effect('after a failed build, the next ask starts a fresh build', () =>
  story(
    Story.given(sass, started, new BuildFailed({ reason: 'npm 503' })),
    Story.when(sass, new RequestBuild({ by: 'agent-b', at: 3_000 })),
    Story.then(sass, new BuildStarted({ by: 'agent-b', at: 3_000 })),
  ),
);

it.effect('a hand-registered tool that passes its check in the isolate: it is kept', () =>
  story(
    Story.when(sass, new Register({ hash: 'abc', version: 'script@1', isolateMatchesExpected: true })),
    Story.then(sass, new Registered({ hash: 'abc', version: 'script@1' })),
  ),
);

it.effect('a hand-registered tool that fails its check: it is not kept', () =>
  story(
    Story.when(sass, new Register({ hash: 'bad', version: 'script@1', isolateMatchesExpected: false })),
    Story.rejected(new DoesNotMatchRealTool({ reason: 'isolate differs from the expected output' })),
  ),
);

it.effect('a hand-registration while a build is running: it waits for the build', () =>
  story(
    Story.given(sass, started),
    Story.when(sass, new Register({ hash: 'abc', version: 'script@1', isolateMatchesExpected: true })),
    Story.rejected(new AlreadyBuilding({ by: 'agent-a' })),
  ),
);

it.effect('forgetting a built tool: the next ask builds it again', () =>
  story(
    Story.given(sass, started, new Built({ hash: 'abc', version: 'sass@1.0.0' }), new Forgotten({})),
    Story.when(sass, new RequestBuild({ by: 'agent-b', at: 4_000 })),
    Story.then(sass, new BuildStarted({ by: 'agent-b', at: 4_000 })),
  ),
);

it.effect('forgetting a tool nobody has: it is refused', () =>
  story(Story.when(sass, new Forget({})), Story.rejected(new NothingToForget({}))),
);
