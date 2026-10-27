# 01: isolate runner and tool registry

**Claim.** An agent workspace on a Durable Object can run file steps and two npm tools in Worker isolates, with no container.

**Setup.** One Durable Object per workspace. `marked` and `js-yaml` are bundled by hand and put in the registry. Five tasks run against the deployed Worker.

**Run.** Commit `a6872d0`. Gate: `proof/gate.sh` at that commit.

**Result.** 5/5 tasks passed. Every step ran in an isolate.

**What it leaves.** The registry, the isolate runner and the tool contract `run({args, files}) -> {stdout, files}`. Experiment 02 uses all three.

**Limit.** The tools were bundled by hand. Experiment 02 removes that step.
