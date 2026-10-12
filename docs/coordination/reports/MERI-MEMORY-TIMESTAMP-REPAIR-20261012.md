# Memory proposal timestamp admission repair — 12 October 2026

Author worktree: `/workspace/meri-memory-repair-20261012`; branch:
`task/meri-memory-timestamp-repair-20261012`; exact base:
`c57b7d26df7de2acbd8c7d8edc7098f7d495053a`.

## Implementation outline recorded before source changes

The existing private proposal validator owns inert DTO admission, trusted
subject binding, descending proposal ordering and coverage classification.
Add finite-instant admission at this same boundary before a timestamp can
participate in ordering or coverage. Preserve its interface and dependency
direction; introduce no persistence, authorization, schema, catalog or public
0.1 changes. The operation remains unmapped and unavailable.

The independent reviewer demonstrated that Ajv accepts the RFC3339 leap-second
timestamp `2026-06-30T23:59:60Z`, while JavaScript's `Date.parse` returns `NaN`.
Comparisons against `NaN` currently allow invalid complete pages, within-page
ordering and retained-page continuation. Preserve the original 15 tests
byte-for-byte as a prefix; append rejection regressions and ordinary finite
timestamp positive/order controls. Capture failures before the repair, then
run focused tests, the original independent probes, full contract checks and
public distribution checks against exact locked dependencies with scripts
disabled during installation.

Source paths are exclusively the private memory proposal validator and appended
memory proposal tests. Evidence is under
`docs/qualification/candidates/memory-timestamp-repair-20261012/`. The independent
reviewer owns all pinned policy/schema review and acceptance. No private
producer bodies are copied. Administrator self-approval policy remains
unresolved and unchanged. Author checks establish only a source candidate;
independent review and root integration acceptance are still required.

## Results

**SOURCE_ONLY_RETURN_FOR_INDEPENDENT_REVIEW.** The local `proposalTimestamp`
helper rejects nonfinite parsed instants. Every row passes this check before
coverage classification and within-page ordering. Both continuation boundary
instants also use it. Valid offsets and equal-instant descending UUID ties keep
their existing semantics. No new module, export, dependency or policy was added.

| Check | Before repair | After repair |
| --- | --- | --- |
| Original 15 plus four appended focused groups | 16/19 pass; three expected rejection failures retained | 19/19 pass |
| Unchanged eight independent reviewer probes, replayed by author | 5/8 pass; three expected rejection failures retained | 8/8 pass |
| Full contract suite (`npm run check:contracts`) | Not rerun by author before repair | 215/215 pass |
| Public distribution | Not rerun by author before repair | Generated-byte check, strict typecheck, 7/7 public tests pass |
| Source whitespace | Not applicable | `git diff --check` passes |

Author replay of reviewer probes is **not independent acceptance**. The original
reviewer failure streams, metadata and probe file were copied byte-for-byte from
the reviewer's evidence directory; their original `adversarial-original.*` names
remain. Author before/after runs have separate labels and raw streams. See
[before checks](../../qualification/candidates/memory-timestamp-repair-20261012/before-checks.json),
[after checks](../../qualification/candidates/memory-timestamp-repair-20261012/after-checks.json)
and [artifact index](../../qualification/candidates/memory-timestamp-repair-20261012/artifact-index.json).

Both exact-lock installations used `npm ci --ignore-scripts` with owned cache
`/tmp/meri-memory-timestamp-npm-cache-20261012`; root and contract installations
exited zero. Node and npm versions, source SHA-256 identities and preservation
details are in [preservation](../../qualification/candidates/memory-timestamp-repair-20261012/preservation.json).
The original test file's 10,119-byte prefix and all 15 bodies are unchanged.
All 53 other tracked contract/root-dependency files are byte-identical to the
pinned base, including schema, composition owner, catalog, registry, generated
public distribution and locks. Only the assigned private validator and test
file change outside the assigned report/evidence paths. Raw `.bin` streams are
marked binary locally to preserve their original bytes.

## Limits and next owner

The independent reviewer owns the 14 pinned private policy/schema references;
this author used the scrubbed handover, source contract and review probes.
No private producer source body is published. The producer's administrator
self-approval versus wrapper's another-reviewer conflict is unresolved; this
repair neither exposes approval nor selects a policy. `list_memory_proposals`
remains unmapped/unavailable, with false approved-fact/evidence flags and no
negative assertion. Registry counts and public 0.1/private 0.2 separation are
unchanged.

Current-source compatibility, trusted producer authority, live row ownership,
source connectivity, runtime/G1, database, model and cloud gates were unrun and
remain open. No paid models, cloud actions, provider/customer operations,
Hermes/native jobs, frontend edits or shared-state mutations were performed.
Dependency download was the only external author action. All local check
processes exited; no author background service was created. Independent repair
replay and root integration acceptance are the next steps.
