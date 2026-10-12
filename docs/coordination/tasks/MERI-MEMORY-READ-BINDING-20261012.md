# Memory proposal read binding — bounded source task

Author: Codex memory binding lane. Base:
`7ba0e9d10ebf684e162dcc7c143915afdbf00f32`; dedicated worktree
`/workspace/meri-memory-binding-20261012`, branch
`task/meri-memory-read-binding-20261012`. The earlier repair branch/worktree is
preserved. Soft deadline: 30 minutes; every spawned local check has a 240-second
deadline and owned process-group reaping. No delegation or publication.

## Implementation outline (before edits)

1. Extend the existing canonical `CATALOG_OPERATION_BINDINGS` with
   `memory.list_own_proposals@0.2.0`, reusing the reviewed memory schema and
   validator functions unchanged. Compose that existing validator family into
   the resolver. Add no handler, source adapter, alternate registry or runtime.
2. Admit `subject` and optional retained `previous:{request,page}` through
   operation-specific frozen binding metadata. Keep the prior 13 bindings'
   context grammar (`nowMs`, `actorId`, `previousPage`, plus output `request`)
   unchanged. Memory refuses those legacy context keys and always delegates
   trusted subject, selected client and pagination validation to its canonical
   family. Output requires the original request; copy inert data before reads.
3. Map only `list_memory_proposals`, append its pending descriptor with exact
   existing schema hashes, and preserve the 139 original IDs/dispositions and
   all 13 earlier descriptors. All 14 stay unimplemented/pending, null-handler,
   zero-retry. Selected/deferred remain 96/43; selected unmapped becomes 82.
4. Preserve original baseline bytes and all assertions except intentional
   mapping/count expectations. Add independent synthetic binding tests for
   complete/empty/partial/unavailable outcomes, immutable normalized requests,
   subject/client substitutions, continuation, nonfinite timestamps, inert
   admission, and unchanged legacy context boundaries.

The existing contract module owns normalization/copy/digest behavior; the
memory family owns proposal-specific input, output, scope, ordering and coverage
rules. Live authorization, freshness, durable state and source access remain
future gateway/producer responsibilities. No public 0.1 shape, dependency,
approval/self-approval/write/review policy, SDK loop or deployment change.

## Ownership and verification

Owned source: private `catalog.json`, `catalog-validation.mjs`,
`operation-contracts.mjs`, `validate.mjs`; existing catalog-binding and
memory-proposal tests (only mapping expectations), plus new
`retrieval-memory-binding.test.mjs`. Owned documentation: this task, the author
report, and `docs/qualification/candidates/memory-read-binding-20261012/author/`.
Parent additionally allocated only the mail test cardinality expectation update;
its original baseline is archived and other assertions stay unchanged.

Run focused checks, root `npm run check`, and public generated/type/package
checks. Install only committed exact locks with `--ignore-scripts` and an owned
`/tmp` npm cache. Preserve failures and unchanged original tests; record exact
commands/exits/source hashes and owned process absence. Source tests are not
runtime/G1 acceptance. Freeze a reviewable commit for a separate reviewer.

No paid model, cloud, provider/customer-data, database, network/security change,
frontend, Hermes, or live source action. Only ordinary dependency package
downloads are authorized external actions for this lane.
