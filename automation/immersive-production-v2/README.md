# Fresh-agent automation for the Immersive Production Layer

This directory turns `TODO.md` into a resumable serial implementation chain:

> one bounded queue item → one new Hermes process → one commit → one verified
> push → the next new process.

No chat is resumed. `--ignore-rules` disables injected memory, project/user rules,
and preloaded skills, so task coordination comes from committed repository state,
`TODO.md`, and `QUEUE.md`. Provider credentials and enabled runtime tools,
plugins, or MCP servers remain process-level environment rather than chat history.

## Files

- `QUEUE.md` — human and machine coordination surface, grouped by the 14 planned
  pull requests.
- `chain_driver.py` — standard-library Python driver.
- `test_chain_driver.py` — parser, dependency, prompt, and checkbox tests.
- `../../TODO.md` — product authority and definition of done.
- `../../docs/adr/ADR-011-immersive-production-distribution.md` — accepted
  monorepo/plugin payload boundary.

Task ids preserve the original proposal row (`IP-08B`, for example) while the
PR heading records the expanded executable sequence. The ids remain stable when
one source row is split into several reviewable pull requests.

## Proposal coverage

| Proposal item | Queue owner(s) |
|---|---|
| T0.1 determinism | `IP-02A`–`IP-02C` |
| T0.2 frame telemetry | `IP-03A`–`IP-03C` |
| T0.3 reference intake / Figma boundary | `IP-04A`, `IP-04B` |
| T1.1 single starter | `IP-05A`, `IP-05C` |
| T1.2 copied quality controller | `IP-05B` |
| T1.3 interaction capture | `IP-06A`, `IP-06B` |
| T1.4 implementation evaluation | `IP-07A`–`IP-07C` |
| T2.1 unified lab | `IP-08A` |
| T2.2 shader modules | `IP-08B`–`IP-08D`, `IP-11A` |
| T2.3 GPU particles | `IP-09A`, `IP-09B` |
| T2.4 cinematic timeline | `IP-09C` |
| T3.1 procedural geometry | `IP-10A`–`IP-10C` |
| T3.2 shader-driven UI | `IP-11A`–`IP-11C` |
| T3.3 volume research gate | `IP-10D` |
| T4.1 distribution decision | `IP-01A`, ADR-011 |
| T4.2 self-lint new surfaces | `IP-05D` |
| T4.3 version discipline | `1.10`/Tier 0, `1.11`/Tier 1, `1.12`/Tier 2, `2.0`/Tier 3 plus `IP-11D` closure |
| T4.4 baseline comparison | `IP-06C` |
| T4.5 audio automation | `IP-06B` |
| Definition of done | `IP-11D` links and re-runs all evidence |

The queue intentionally folds cross-cutting Tier 4 work into the earliest PR
whose executable artifacts can prove it. It does not create guidance-only PRs
for those surfaces.

## Safety model

The driver:

1. refuses detached HEAD, `main`, `master`, a dirty worktree, or a mismatched
   `--expected-branch`; when the remote branch already exists, its head must
   equal local HEAD before a child starts;
2. requires one `--pr N`, so it cannot run the complete 2.0 proposal as one
   combined branch;
3. validates that every checked task has only checked predecessors, then selects
   only the first unchecked task in the requested PR and rechecks its direct
   dependencies;
4. launches `hermes chat --query-file … --in … -Q --yolo --ignore-rules` with
   no resume or continue flag, producing a fresh session without injected
   memory, rules, or preloaded skills;
5. stops on timeout, non-zero exit, empty/no-reply output, unexpected branch,
   dirty worktree, zero/multiple task commits, or failed remote-head verification;
6. retries an empty reply once by default (configurable with `--empty-retries`),
   and only if HEAD and the worktree are unchanged;
7. reads queue blobs as raw bytes and checks that the task commit leaves
   `QUEUE.md` unchanged except for its own exact checkbox transition, so line
   endings, boundary whitespace, later tasks, and specifications cannot be rewritten;
8. requires the previous HEAD to be an ancestor of the new HEAD and exactly one
   commit to have been added, so rewritten history cannot pass a count check;
9. checks that the agent pushed exactly its local commit to the current remote
   branch; and
10. stops with the task unchecked when a required gate failed, was unavailable,
    or the child omitted its checkbox. It never repairs completion state.

Logs and transient prompts live under the worktree-aware Git-internal path
returned by `git rev-parse --git-path wdu-agent-chain`, followed by `<run-id>/`.
They do not dirty the repository. The prompt file is deleted after each process.

`--yolo` is intentionally present because this is a headless implementation
runner with commit/push duties. Run it only in a dedicated worktree or clone.
Never share that working tree with an interactive agent or another chain.

## Baseline caveat

The proposal is intentionally based on 1.9.1 commit `b5474cc`, matching the
review evidence in `TODO.md`. Before implementation begins, compare the chosen
target branch with that commit. If the repository layout has since changed,
resolve that migration explicitly in PR 1; do not let a fresh agent silently
reinterpret old paths or overwrite newer packaging work.

## Validate the plan

From the repository root:

```bash
python3 -m unittest automation/immersive-production-v2/test_chain_driver.py
python3 automation/immersive-production-v2/chain_driver.py --check
python3 automation/immersive-production-v2/chain_driver.py --list --pr 2
python3 automation/immersive-production-v2/chain_driver.py --dry-run --pr 2
```

`--dry-run` prints the exact next task and child prompt without requiring a clean
worktree or calling a model. Confirm that it prints `IP-02A` before the first
implementation run.

## Branch and PR workflow

Do not run all groups on the proposal branch. After this proposal is reviewed:

```bash
# Example only: start PR 2 from the reviewed/merged target.
git switch main
git pull --ff-only
git switch -c feat/immersive-02-determinism

python3 automation/immersive-production-v2/chain_driver.py \
  --pr 2 \
  --rounds 10 \
  --expected-branch feat/immersive-02-determinism \
  --provider openai-codex \
  --model gpt-5.6-sol
```

Provider and model are optional. Pin them when reproducibility matters or the
default provider has become unreliable. Use identifiers that are actually
configured in the active Hermes profile; the driver deliberately does not guess
a fallback model.

`--rounds 10` means “continue with fresh agents until ten tasks have run or this
PR group becomes empty,” not “cross into PR 3.” The PR boundary always wins.
The default is one round, which is safest for the first execution.

After the driver prints `QUEUE_EMPTY`:

1. inspect `git log --oneline`, every commit stat, and the queue diff;
2. rerun the PR's complete validation matrix yourself;
3. inspect browser/performance artifacts and every `UNAVAILABLE` status;
4. verify the remote head and CI artifacts;
5. open and merge only that PR group; then
6. create the next implementation branch from the merged target and run the next
   `--pr` number.

The driver does not open or merge pull requests. That is a deliberate review
boundary, not a missing feature.

## Background execution

A complete PR group can take hours. In Hermes Desktop, start it through the
tracked background terminal with completion notification rather than shell
`nohup`, `&`, or an untracked process. Example command:

```bash
python3 automation/immersive-production-v2/chain_driver.py \
  --pr 3 \
  --rounds 10 \
  --expected-branch feat/immersive-03-telemetry
```

Per-agent timeout defaults to 3600 seconds. Override with `--timeout`; the child
also receives a slightly smaller Hermes `--run-budget`, preventing a stale model
call from consuming the entire subprocess timeout.

## Failure recovery

`CHAIN_STOP` means do not start another agent in that tree.

1. Resolve `git rev-parse --git-path wdu-agent-chain`, then read
   `<latest>/chain.log` and the attempt stdout/stderr logs below it.
2. Inspect `git status`, `git log -3 --oneline`, the current task marker, and the
   remote branch head.
3. If an agent left uncommitted work, either complete/review it manually or reset
   it deliberately. Never let the next fresh agent guess ownership.
4. If HEAD advanced but the remote did not, inspect the commit before pushing;
   the driver intentionally refuses to repair an unverifiable push.
5. If browser/GPU execution is unavailable for a required acceptance gate, leave
   the task unchecked and provide the capability on a later run. Do not check it
   as documentation-only progress.
6. Re-run `--dry-run --pr N` and then the chain only after the branch is clean and
   the queue accurately describes reality.

## Invariants carried into every child prompt

- exactly one queue task and no drive-by refactor;
- ADR-011 distribution boundary;
- progressive disclosure and negative gating;
- deterministic, evidence-linked validation;
- `UNAVAILABLE` is never `PASS`;
- no paid design-tool dependency or committed credential;
- no generic VDB exporter, premature npm package, extra starter, or “apply all
  effects” path;
- selective staging, one task commit, mandatory push, and a clean worktree.
