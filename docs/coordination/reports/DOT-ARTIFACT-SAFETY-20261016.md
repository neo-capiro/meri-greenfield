# Package-four artifact safety repair outline

Base: `eca78d458acb46cbfd54a94cf870841d999ef6b1`, isolated branch
`dot/meri-artifact-safety-20261016`. Qualification transferred the provisional
claims without edits. Budget/planner cleared the command executor seam.

Canonical owners and implementation order:

1. Retention's acknowledged ledger and watermarked journal verify the persisted
   watermark before ordinary mutations. Recovery alone bypasses the serving
   check under its existing exclusive lock, including recovery replan appends.
2. Browser page context invalidates all overlapping calls and retains a stable
   operation generation. Permission release checks the same generation after
   approval; invalidation cancels pending approval waits.
3. Command execution retains the durable journal claim, budget reservation and
   current-authority gate as the effect boundary. HTTP source preparation reads
   credentials/metadata only; completed and UNKNOWN replays perform no attachment
   registration or source effect.
4. Preview publication requires a durable claim before render/write, a retained
   allocated object identity, and recovery without duplicate writes. Any missing
   deployed store/schema contract is proposed explicitly to qualification;
   no migration IDs are invented.

Verification uses production modules and bounded synthetic ports only. Each
confirmed finding gets a negative regression against unchanged base source.
No compiler, actual browser, renderer, DB, external upload/provider or P2b retry.
Historical manifests and candidate h HOLD remain unchanged; changed hashed rows
will be reported. Real integration and source acceptance remain separate gates.

## R4-RET-1 implemented, pending independent review

Ordinary ledger appends and projection writes first verify the persisted
watermark. Advancement also carries the process's minimum known sequence;
both the memory adapter and PostgreSQL adapter compare that floor atomically
with the advance. PostgreSQL uses the existing bounded transaction/recovery-lock
owner plus a watermark advisory/row lock; no schema changes. This closes a
restore between guard read and advancement. Recovery explicitly bypasses the
serving check under its existing exclusive lock, including replan appends.

Synthetic verification on Node 24.19.0, one process, 128 MiB heap, no DB:

- Eleven retention source-control files (all except real-PostgreSQL
  `postgres-journal-pg.test.mjs`): **51 pass, 0 fail, 0 skip**, exit 0.
- Focused startup/watermark files: **16/16 pass**. Exact-base production source
  restored temporarily: **11 pass, 5 fail**, all five safety negatives; fixed
  source restored afterward. Exclusive recovery replan passes in both cases.
- Cases: restore→new suppression→read, release as first post-restore write,
  restore after durable ledger ACK, restore during guard read, and guarded SQL
  advance on a restored row. Prior UNKNOWN/lease/purge safety checks pass.

The local watermark port's `minimumSequence` option is an intentional internal
adapter change. Real PostgreSQL and multi-process restore orchestration remain
UNRUN, pending a bounded heavy-test slot and the unapplied watermark schema.

## R4-BRW-1 implemented, pending independent review

Page context now owns one active operation generation and an internal identity
token/AbortSignal. A competing or duplicate operation invalidates the first and
is itself refused by PreToolUse. This also fences navigation while an already
approved operation is executing. Approval waits are cancelled on invalidation;
the gate rechecks the exact captured token immediately before allowing execution.
Invalidated cancellation/completion never restores the stale origin. Fresh page
observation is required afterward. Tool-use tracking is bounded at 4096 per run.

Synthetic permission/page-generation/egress-control checks: **22 pass, 0 fail,
0 skip**, exit 0. Five focused safety tests against exact-base page-context and
permission source: **0 pass, 5 fail**; restored source: **5/5 pass**. These cover
both interactions in overlap, navigation during pending approval, duplicate IDs,
tab changes during approved execution, and reentrant invalidation during receipt
validation. The existing scripted SDK helper now
uses unique default tool-use IDs; its prior competing-call expectation changes
to an explicit denial. An initial missing-saxes import was resolved by reusing
the pinned installed library; no npm install. One baseline attempt was cancelled
because an early test assertion left the old approval timer pending; the test
now settles its synthetic port before asserting, and the recorded negative exits
in 178 ms. No real browser, SDK query, activation-gate change or P2b retry.
