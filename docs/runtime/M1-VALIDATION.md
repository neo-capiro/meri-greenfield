# M1 runtime validation ledger

Brief: [Fable M1 runtime, comment 6329870986](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6329870986).
Original brief base: `eb6579204f495eb35140f4e1cb013b641913da5f`; tree: `3d21c62f6cabacf0cc21378f887f2e55c281bffc`.
Branch: `feat/meri-m1-runtime`. This is a draft source-validation checkpoint, not completion of every M1 ticket or release acceptance. The historical 31-file combined checkpoint below remains **not green**. Its one failure has a bounded investigation receipt. The Agent 1 v2 section separately records the later MR-01 correction and final combined qualification; no historical failure is erased.

## Evidence boundary

Recorded host: Linux 6.18.55, UID 0, Node 24.19.0. Dependencies were reused only where committed lockfiles matched. These are canonical service/journal/worker compositions with synthetic SQL, identity, task and provider ports. Root-host passes do not qualify nonroot PostgreSQL 16, physical task absence, deployed identity, immutable images or live SDK/provider behavior.

Task evidence is outside Git at `/workspace/scratch/f4c316385060/m1-review-evidence/`. Receipts retain commands, selectors, UTC times, source/dirty-state pins, lock and output hashes, failures and rerun reasons. A committed tree alone does not pin concurrent uncommitted changes; use the candidate file hashes in each receipt. Exact-base module-loader runs use base Git blobs with the candidate regression tests; they are not pristine base checkouts or base images.

## Ticket results

Counts below are per-ticket suite results. Do not sum them: E12 repeats MR-02's 43 continuation cases, and baseline/mutation/rerun counts repeat test identities. The historical combined checkpoint uses one deduplicated 31-file list; the Agent 1 v2 selection adds the already-corrected continuation fixture. Do not add combined counts to focused results.

| Ticket | Recorded source result | Mutation coverage / remaining closure |
|---|---|---|
| MR-01 historical Stop | Focused **70/70**, later-foreclosure boundary **1/1**, then cached-generic retry **44/44** across registry/custody suites. These overlap and must not be summed; the combined checkpoint predates the retry correction. | **25/25 cumulative mutations killed**, covering all 23 new locally executable cases, including the directed cached-generic retirement-route mutant. That correction reuses exact facts already held by a cached generic workload; it does not authorize fresh missing-custody reconstruction. Native PG custody/trigger mutation is Fable-run. Broader generic profiles and legacy later rows remain explicit held boundaries. The exceptional later-foreclosure receipt is corrected separately by Agent 1 v2 below; the old boundary result remains historical evidence. `mr01/handoff.md`, `mr01/mutation-results-final.json`, `mr01/cached-generic-head.log`, `mr01/mutations/cached-generic-retire-route.log`. |
| MR-02 control-read classification | Lifecycle 59/59; completion/terminal 7/7; continuation 43/43: **109 distinct tests within this ticket**. Baseline lifecycle 50/50. | 11/11 mutations killed across all 14 new/changed test identities. Unmarked refusals, absolute deadline, backoff, fenced reads and effect barriers retained. `mr02/head-receipt.json`, `mr02/mutations.json`. |
| MR-06 durable receipt readback | **40/40** across journal readback, transition and composed servability suites; exact-base existing cases 32/32. | 8/8 mutations killed, covering all eight new cases. Internal reader only: public fresh-identity/current-access/retention facade and contract/consumer integration remain owner handoffs. `mr06/handoff.md`, `mr06/head/receipts/mr06-head.json`, `mr06/candidate-pins.json`. |
| MR-08 session renewal | **5/5** on exact-base source and candidate: expired bearer/control restart/cursor, changed tenant/actor/client, transient503 then revocation. | Three semantic mutations killed; every new case covered. `mr08/summary.json`. This closes the synthetic renewal crossing only. |
| MR-08 terminal recovery | **1/1 exact-base and head** in `apps/control/conversations/test/m1-terminal-recovery.test.mjs`. | Four semantic mutations killed. Actual worker-window exhaustion, uncertain terminal recording, proven retirement, readable `ATTEMPT_LOST`, session reconstruction and one explicit successor; one provider query. `mr08-terminal/summary.json`, `mr08-terminal/receipts.json`. |
| M1-X1 admissibility | Focused **11/11** readiness cases; **57/57** across the seven-file integrated selector below, including C11. | 8/8 X1 mutations killed. Internal read-only authority only; public history/status field, additive package version and agent 4 adoption remain owner handoffs. `x1/receipt.json`, `x1/mutation-results.json`. |
| E12-D image-only resume/fork | Focused **57/57**: authority 10, deploy 4, worker continuation 43. The last 43 overlap MR-02. Exact-base deploy cases: 2 pass, 2 fail due to inherited image-only refusal. | 6/6 mutations killed across new/changed identities. Current target versions are pinned separately; source checkpoint/session compatibility remains enforced. `e12/head-receipt/receipts/e12-focused.json`, `e12/mutations/summary.json`. |
| C11 accept integrity | **1/1** in `next-run-accept-integrity.test.mjs`, separate from the 11 X1 cases. | Identity-to-run mutation killed; continuity read remains refuse-only. See `x1/c11-identity-unchecked.log`. |
| Candidate 9 running assertion / C10 router TLS | Existing composed admission **2/2** with `PATH=/missing`; base passes 2/2 with OpenSSL and fails to load without it. | Unrelated refusal and foreign leaf SAN mutations killed. No new test cases. Node-only throwaway certificates preserve real TLS checks. `followups/summary.json`. |
| Native restorer PG fixture | Transition-authority/retirement seeding repaired; syntax checked. | **Fable-run** native PostgreSQL 16 suite; no SQL executed locally. |
| MX-13 restart fixture | **8/8 head**, versus **5 pass / 3 fail** on exact base. | Three mutations killed across all three changed cases. The public cancellation response proves a durable fence; tests separately drain real cleanup and require physical-stop/revocation evidence. UNKNOWN remains unretired. `mx13-restart/summary.json`, `mx13-restart/justification.md`. |
| MX-13 continuation fixture | Original exact-base fixture **3 pass / 4 fail** with `LIFECYCLE_CONFIGURATION`; corrected fixture **7/7 over exact-base modules and 7/7 M1 source**. | Four directed mutations killed across the four affected cases. The fixture supplies the already-required reconciler, proves it is unused for continuation, and asks the canonical current-run owner instead of keeping a historical source current. Exact `SESSION_REFUSED` preserves durable `APPLIED` readback and all no-extra-effect assertions. No production change. `mx13-lifecycle-continuation/summary.json`, `run-receipts.json`, `mutation-results.json`. |
| MR-09 provider accounting | Source inventory/handoff only; no proxy/accounting qualification result claimed here. | **Blocked owner handoff:** provider terminal/EOF/usage matrix, proxy-death custody and exact historical settlement `readOutcome`; UNKNOWN must retain liability. No proxy/gateway edits in M1. |
| MX-13 regression receipt | Existing EX-06 receipt/inventory machinery reused. | Separate shared-manifest draft [#207](https://github.com/neo-capiro/meri-greenfield/pull/207) accounts for all 193 gaps; see gates below. |

MR-06 and M1-X1 public integration is tracked by [owner handoff 6330070395](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6330070395). An internal source pass does not close that handoff.

## Public provenance and offline synthesis

Read-only source exports pin every base blob to `eb6579204` and candidate bytes to
`d496ab591` plus the captured working-file hashes. No generator output or contract
file was edited. Each of the 12 generators ran independently with `--check`:
five passed; actions, documents, lifecycle, history and input retained metadata
drift; settings/task commands could not complete without their recorded offline
toolchain. The same classifications occurred on both base and candidate.

Ten stale provenance rows across seven metadata families already existed on the
base. M1 additionally changes the lifecycle service source. The source owners must
regenerate those families at the final reviewed head, using the repository
generators and recorded versions. [Ownership confirmation 6330527488](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6330527488)
supersedes the routing request in [handoff 6330503458](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6330503458):
**no regeneration until agent 2 merges and the existing sequencing/ownership holds permit it**.
This M1 checkpoint does not edit generated contract output or waive those holds.
Settings/task commands require Rolldown 1.2.13, TypeScript 5.9.3,
json-schema-to-ts 3.1.1 and ts-algebra 2.0.0; no substitute was installed.

| Public suite | Exact base | Candidate | Classification |
|---|---|---|---|
| Initial input | 6/6 | 6/6 | Pass |
| Lifecycle | 20/20 | 20/20 | Pass |
| History source | 6/6 | 6/6 | Pass |
| Application | 54/54 | 54/54 | Pass |
| History public | 29/30 | 29/30 | Inherited history/store provenance pin |
| Input public | 20/21 | 20/21 | Inherited input/http provenance pin |

`node infra/qualification/checkpoint-app.mjs` exited 0 on both source exports;
`node --test infra/qualification/checkpoint-security.test.mjs` passed 3/3 on
each. The offline templates are byte-identical, SHA-256
`f2b578ea75b3069e11a4eafca41201e52d2afd99edf368a5426fe16c02587485`.
No AWS operation was involved. `mx13/classification.md`,
`mx13/command-receipts.json` and `mx13/source-manifest.json` retain exact commands,
dependency layout, hashes and the two superseded incomplete-export failures.

## Deduplicated combined checkpoint and source checks

At local head `9d10658072f059c0706d4623a0a3240b8f24f273`, tree
`0728140d93af804236500677e1d7f1ffc6d2930f`, the 31-file run recorded
**345 tests: 344 pass, 1 fail, 0 skipped, 0 cancelled**; exit 1. This is **not green**.
The failure is `parked start RPC receives the shorter target deadline and no later effect dispatches`
in `apps/control/conversations/test/lifecycle-transition.test.mjs`, with
`LIFECYCLE_EFFECT_UNKNOWN`. The exact named case subsequently passed **1/1** on the
same recorded head. Its fixture is byte-identical to the brief base and starts a
220 ms target cutoff before pre-dispatch ownership/receipt work, allowing the cutoff
to expire before the awaited effect hook enters. The bounded classification is
**host-sensitive inherited fixture timing; semantic regression not reproduced**.
This is not a PostgreSQL prerequisite. No code, allowance, skip or gate changed,
and the isolated pass does not replace the failed combined receipt.
`mr06/combined-target-rerun/classification.json` and its
`receipts/mr06-parked-target-current.json` preserve the source comparison and rerun.

`combined-head/receipts/m1-runtime-combined.json` retains the actual child/wrapper argv,
UTC time, scrubbed environment, output hashes and failure. `combined-files.json` is
the deduplicated selector; `combined-source-pins.json` pins the changed source and all
selected tests at that checkpoint. These pins
qualify this checkpoint only, not the subsequent cached-generic retry correction or a
later rebased head. The EX-06 runner executed the following child command under its
subreaper and environment scrubber:

```sh
/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --test --test-reporter=spec --test-reporter-destination=stdout --test-concurrency=1 \
  apps/control/conversations/test/lifecycle-receipt-readback.test.mjs \
  apps/control/conversations/test/lifecycle-transition.test.mjs \
  apps/control/conversations/test/m1-terminal-recovery.test.mjs \
  apps/control/conversations/test/next-run-accept-integrity.test.mjs \
  apps/control/conversations/test/next-run-lineage-guards.test.mjs \
  apps/control/conversations/test/next-run-lineage-integrity.test.mjs \
  apps/control/conversations/test/next-run-owner.test.mjs \
  apps/control/conversations/test/next-run-readiness.test.mjs \
  apps/control/conversations/test/next-run-recovery.test.mjs \
  apps/control/conversations/test/run-budgets-load.test.mjs \
  apps/control/conversations/test/stop-races.test.mjs \
  apps/runtime/native-authority/test/continuation-authority.test.mjs \
  apps/runtime/native-authority/test/continuation-deploy.test.mjs \
  apps/runtime/native-authority/test/historical-stop-facts.test.mjs \
  apps/runtime/native-authority/test/next-turn-admission.test.mjs \
  apps/runtime/native-authority/test/original-retirement.test.mjs \
  apps/runtime/native-authority/test/remote-allocation-preflight.test.mjs \
  apps/runtime/native-authority/test/task-request.test.mjs \
  apps/runtime/product-ports/test/lifecycle-continuation-servability.test.mjs \
  apps/runtime/test/conversation-survives-deploy.test.mjs \
  apps/runtime/test/historical-stop-custody.test.mjs \
  apps/runtime/test/initial-run-bindings.test.mjs \
  apps/runtime/test/next-turn-prepare.test.mjs \
  apps/runtime/test/prepared-run-bindings.test.mjs \
  apps/runtime/test/prepared-run-registry.test.mjs \
  apps/runtime/test/restart-retirement.test.mjs \
  apps/runtime/test/session-renewal-continuity.test.mjs \
  apps/worker/conversation/continuation/test/continuation.test.mjs \
  apps/worker/conversation/test/completion-activity.test.mjs \
  apps/worker/conversation/test/lifecycle-activity.test.mjs \
  apps/worker/conversation/test/terminal-settlement.test.mjs
```

| Source check | Recorded result | Evidence / limit |
|---|---|---|
| Runtime typecheck | `npm run typecheck --prefix apps/runtime --silent`: exit 0. | `combined-types/receipts/runtime-typecheck.json`. |
| Conversations typecheck | `npm run typecheck --prefix apps/control/conversations --silent`: exit 0. | `combined-types/receipts/conversations-typecheck.json`. |
| Worker typecheck selector | `npm run typecheck --prefix apps/worker/conversation --silent`: exit 1; **invalid selector**, not a pass. | Worker package defines no `typecheck` script on exact base or candidate; the package hash is identical. `combined-types/worker-selector-classification.json`. |
| Changed JavaScript syntax | Direct `node --check` source checks recorded exit 0. | Root command result; no separate archived receipt or test count. Syntax only, with no worker typecheck or native execution inferred. |

The initial typecheck receipts record local head `3c2e247e18e2f7cc9f624b425dac6c5aa3eccb13`
and concurrent dirty paths; they do not by themselves certify subsequent edits.
After the cached-generic correction, `npm --prefix apps/runtime run typecheck`
again exited 0 at local `c23dbeb27ef79ac5666f5396e56cdd7e554e624c`; see
`mr01/cached-generic-typecheck.log`.

GitHub publication maps these local source commits to commits with identical trees:

| Qualified local commit | GitHub publication commit | Identical tree |
|---|---|---|
| `9d10658072f059c0706d4623a0a3240b8f24f273` | [`d6bfaa368ded033acc21b8e12d1e2f9b635eed22`](https://github.com/neo-capiro/meri-greenfield/commit/d6bfaa368ded033acc21b8e12d1e2f9b635eed22) | `0728140d93af804236500677e1d7f1ffc6d2930f` |
| `c23dbeb27ef79ac5666f5396e56cdd7e554e624c` | [`779612f94452b3d9c889293a1c21ca037e9c9ca0`](https://github.com/neo-capiro/meri-greenfield/commit/779612f94452b3d9c889293a1c21ca037e9c9ca0) | `537921567d8df6ee77795d220363362e75498fa8` |

The first mapping identifies the combined checkpoint; the second includes the
subsequent cached-generic correction. `final-source-pins.json` records that pre-ledger
checkpoint: 38 changed source/test/document files, five lockfile hashes, the final
runtime typecheck/log hash and an empty forbidden-path list. Adding this validation
document changes the final tree; it does not change those pre-document source pins.
Receipt file hashes still govern any bytes that were uncommitted at execution; equal
trees do not erase that qualification limit.

## Recorded focused commands

Run from the repository root with its locked dependencies. EX-06 receipts additionally pin its subreaper wrapper, environment scrubber and reporter arguments.

```sh
# MR-01 cached-generic retry: 44, with no command-specific environment override.
node --test apps/runtime/test/prepared-run-registry.test.mjs apps/runtime/test/historical-stop-custody.test.mjs

# MR-02: three disjoint groups, 59 + 7 + 43.
node --test apps/worker/conversation/test/lifecycle-activity.test.mjs
node --test apps/worker/conversation/test/completion-activity.test.mjs apps/worker/conversation/test/terminal-settlement.test.mjs
node --test apps/worker/conversation/continuation/test/continuation.test.mjs

# MR-06: serial composition, 40.
node --test --test-concurrency=1 apps/control/conversations/test/lifecycle-receipt-readback.test.mjs apps/control/conversations/test/lifecycle-transition.test.mjs apps/runtime/product-ports/test/lifecycle-continuation-servability.test.mjs

# MR-08 renewal: 5.
node --test apps/runtime/test/session-renewal-continuity.test.mjs

# MR-08 expired-window recovery: 1.
node --test apps/control/conversations/test/m1-terminal-recovery.test.mjs

# M1-X1 and C11 integrated: 57, including 11 readiness + 1 acceptance-integrity.
node --test apps/control/conversations/test/next-run-lineage-guards.test.mjs apps/control/conversations/test/next-run-lineage-integrity.test.mjs apps/control/conversations/test/next-run-owner.test.mjs apps/control/conversations/test/next-run-recovery.test.mjs apps/runtime/test/next-turn-prepare.test.mjs apps/control/conversations/test/next-run-readiness.test.mjs apps/control/conversations/test/next-run-accept-integrity.test.mjs

# E12-D: 57; continuation.test.mjs overlaps MR-02.
node --test --test-concurrency=1 apps/runtime/native-authority/test/continuation-authority.test.mjs apps/runtime/native-authority/test/continuation-deploy.test.mjs apps/worker/conversation/continuation/test/continuation.test.mjs

# C9/C10 followups: 2, with no openssl discoverable.
PATH=/missing /opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node --test apps/runtime/native-authority/test/next-turn-admission.test.mjs

# Recorded source checks; these do not execute PostgreSQL.
node --check apps/runtime/native-authority/test/native-restorer-pg.test.mjs
npm --prefix apps/runtime run typecheck

# MX-13 continuation fixture: 7, qualified separately after the combined run.
node --test --test-concurrency=1 --test-timeout=20000 apps/runtime/product-ports/test/lifecycle-continuation.test.mjs
```

MR-02's original adjacent command also named a nonexistent `commands.test.mjs`; Node ran the two existing suites (seven cases). The real continuation suite was then explicitly run (43). Do not count that missing selector as a pass. MR-06's parallel timing failures and MR-08's initial loader/short-window fixture failures are retained in their evidence; final serial/corrected fixture results above do not erase them or change production deadlines.

## Acceptance mapping

These are named source witnesses and explicit blockers, not claims of live acceptance.

| Scenario | Named suites / cases | Remaining gate |
|---|---|---|
| E05 expiry / Core503 | `session-renewal-continuity.test.mjs`: renewed bearer after expiry/control restart; transient503 withholding then recovery/revocation. `lifecycle-activity.test.mjs`: marked misses, immediate unmarked refusal, deadline during backoff. | Service-backed identity and browser renewal: Fable-run. |
| E06 identity/client change | `session-renewal-continuity.test.mjs`: changed tenant, actor and client refuse retained/renewed sessions before stream bytes. `initial-input-service.test.mjs`: changed current scope/client cannot recover allocation. | Frontend draft/intent cache invalidation remains frontend-owned. |
| E07 Stop phases | `stop-races.test.mjs`: queued/Temporal NOT_FOUND, caller disconnect, durable fence with UNKNOWN cleanup. `prepared-kickoff.test.mjs`: stop during allocation and late compensation. X1 completed/failed/cancelled cases hold readiness until retirement. | Physical stop/grant revoke and real tool/provider crossing: Fable-run/owner handoff. Generic/legacy custody remains held. The proof-backed later-foreclosure receipt is covered by the Agent 1 v2 correction below; native qualification remains open. |
| E08 failed/cancelled after checkpoint | `next-run-recovery.test.mjs`, `next-run-lineage-guards.test.mjs`; X1 `a failed later turn assesses and admits using the older published checkpoint`. | Native PG/SDK restore and public admissibility integration remain open. |
| E09 image-only release | `conversation-survives-deploy.test.mjs`: completed source and predeploy reserved successor. X1 image-only restart/reservation cases. E12-D resume/fork image-only cases. | Exact immutable image and packed contracts at final head: Fable-run. |
| E10 deploy/rotation in flight | `restart-retirement.test.mjs`, `historical-stop-custody.test.mjs`: first/later fresh render, control rotation, expiry/policy/window drift, old SDK, exact task/grant custody and zero new execution. | Real original-task cleanup: Fable-run. Broader command profiles and legacy later-run custody remain unqualified. |
| E11 SDK/CLI/format incompatibility | `next-run-lineage-guards.test.mjs`, `next-run-lineage-integrity.test.mjs`, X1 compatibility cases; `continuation-deploy.test.mjs`: incompatible SDK/CLI refuses before target or stop. | Frontend recovery copy and exact installed SDK/CLI/format proof remain owner/Fable-run gates. |
| E12 lifecycle controls | `lifecycle-activity.test.mjs`: exact UUID/one claim/no UNKNOWN redelivery. `lifecycle-transition.test.mjs`: lost APPLIED commit ACK. `lifecycle-receipt-readback.test.mjs`: identifiers only, expiry, UNKNOWN and tamper refusals. `lifecycle-continuation-servability.test.mjs`: lost resume response after session-owner restart. `continuation-deploy.test.mjs`: pause/resume/fork deploy crossing. | Public MR-06 recovery contract/facade/consumer and native transaction qualification remain open. |
| E40 missing terminal usage | `completion-activity.test.mjs`: UNKNOWN capture cannot fabricate completed publication; failed SDK result cannot capture success. | **MR-09 blocked owner handoff.** Runtime completion is not provider cost settlement; retain UNKNOWN capacity/purge holds. |

## Remaining qualification and sequencing gates

- **Current order: #205 → M1 → P1 → C9.** [Decision6341932764](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6341932764) supersedes the old P1-before-M1 sequence. [Notice6342277568](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6342277568) explicitly confirms #205 merged and authorizes M1 rebase onto `d3cf54962a954daf4382df535a9c518aff791b0e`, lifecycle-only regeneration, combined suite and `test:public`. P1 remains held until M1's gates and release. C9 stays with agent 2, stacked on P1. Fable owns image/native/rehearsal/release gates; no agent merge/deploy.
- **Zero P1/cross-lane collisions:** current diff from the brief base has no changes under `apps/proxy/product`, `apps/gateway/budget` or `packages/contracts`. Recheck before publication and after rebase.
- **Later FORECLOSED receipt policy:** [decision 6331244090, revision 2](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6331244090), reiterated by [resume 6338385182](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6338385182), supersedes the earlier semantic hold. Only a later attempt durably FORECLOSED before any original existed uses the verified pinned terminal UIEvent's persisted `createdAt` as its existing `expiresAtMs` event-time cutoff, never database commit time. Existing original/admission precedence and dynamic-first immutable expiry remain. Missing/mismatched proof refuses; no public schema, version, route, migration or new execution effect is introduced. See the Agent 1 v2 source correction below.
- **MX13-I1 inherited inventory drift:** the initial sparse-filesystem scan found 1,376 files and 192 uncovered. Exact full-tree enumeration corrected this to **1,377 files: 948 covered, 236 excluded, 193 uncovered**. The missing file was the sparse retained-package `infra/product-preview/runtime-packages/complete-pending-additions.test.mjs`. All 15 runtime product-port test files and `prepared-candidate.test.mjs` are uncovered. The earlier runtime-only split and owner-routing question are superseded by [clarification 6330636339](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6330636339): all **193 uncovered files** may be classified in a separate EX-06 shared-manifest repair draft. Runtime execution is assigned for **123 runtime-owned files**; execution for the **70 other-owner or ownership-uncertain files** remains held for their owners. Outside-lane permission is manifest classification only, with **no product edits** or expansion of execution/file ownership. No replacement runner or silent exclusion.
- **Ledger-load classification:** `apps/control/conversations/test/run-budgets-load.test.mjs` passed **3/3 exact-base and 3/3 head**. No failure reproduced. This is a scripted SQL fixture, not an external PostgreSQL prerequisite; see `mr08-terminal/budgets-receipt.json`.
- **Fable-run:** nonroot Linux PostgreSQL 16, real transaction/process ACK loss, native restoration, task absence/grant revocation, Docker/pinned runtime/proxy image, actual SDK/CLI closure, current Core identity, service-backed history/stream and authorized cloud/live-provider gates. No SQL/AWS/merge/deployment execution is authorized to this agent by these commands.
- **Separate owner gates:** public history/lifecycle/initial-input generators and package provenance through the contracts owner; Python provider-terminal accounting through MR-09's owner. Offline checkpoint synthesis/security is a separate gate and is not included in the Node counts above.

EX-06 draft [#207](https://github.com/neo-capiro/meri-greenfield/pull/207), head
`7d50f9a4a3edbb043adfdf7e158e78609ba6e850`, changes only the suite manifest.
Its inventory is **1,377 files: 1,141 covered, 236 existing exclusions, zero gaps**;
the inventory suite passes **5/5**. Serial execution of the 123 newly covered runtime
files on exact base recorded **1,775 pass / 10 fail / 6 skipped**. Restoring missing
exact-base retained APK/index blobs resolved one fixture failure in a separately
recorded **1/1** targeted rerun; nine base failures across five files remain in that
PR's historical report. Four are the continuation fixture corrected above; five
are deadline-sensitive findings, not confirmed flakes. The other 70 files are
classified only and remain unrun; native prerequisites are Fable-run. No base
failure was excluded, and no test or source fix is bundled in #207.

The continuation fixture has SHA-256
`375f5b8433a059ed17f00fb4d0eb7b39ba55829fc2939c673555f25b8ba8b323`.
Its qualified local commit is `dcc70fb854cf07aef66cb3c8abaa6f7786e5d9e0`, tree
`b0a18409c4c549c12a3f9c2eb2b80c37c68ef5fd`. The exact-base-module run retains
this candidate test; it does not replace #207's pristine-base failure receipt.

The historical combined checkpoint remains **344/345**, with the isolated timing investigation retained separately. It does not qualify the later cached-generic MR-01 correction or MX-13 continuation fixture; the Agent 1 v2 combined run below is a separate result. Public/accounting handoffs, native gates and the named historical-custody boundaries remain open. This ledger must not be used to mark every ticket closed.


## Agent 1 v2 recovery: MR-01 later-foreclosure correction

Recovered parent: `86091db0133f3688a50b9c365b27525b17cd434e`, tree
`b6447220196eb7ead994e2ab475420efb28b7025`. The old checkout and evidence remain
preserved. Neo's sole-writer reconciliation and complete recovery packet permit
this continuation. No earlier ticket implementation or EX-06 manifest repair was
repeated. The isolated checkout is `/dev/shm/agent1-v2-m1`; new evidence is outside
Git at `/dev/shm/agent1-v2-m1-evidence/`.

The historical Stop owner now falls back to the existing canonical
`foreclosureRecord` only after original/admission expiry is absent. For a later
allocation with closed FORECLOSED custody, bounded paged canonical store reads
must find the pinned terminal UIEvent ID and whole-event hash, with the exact run
binding, scopes and failed/cancelled state. Its persisted `createdAt` becomes the
existing private receipt's `expiresAtMs` event-time cutoff. It is never database
commit time or newly created authority. The existing safe-integer receipt contract
also preserves a valid epoch timestamp as zero. Missing/mismatched proof refuses;
original/admission precedence and dynamic-first expiry remain unchanged.

Only `prepared-run-registry.mjs` changes production behavior. The existing
`historical-stop-custody.test.mjs` tests the real journals/registry over synthetic
SQL/task/grant ports; counters and durable custody prove no new preparation,
allocation, grant, model, material-open or restore effects. `original-stop.mjs`
changes commentary only. The runtime and lifecycle READMEs document the private
receipt and existing no-authority successor barrier. No public contract, schema,
route, migration, dependency, shared settlement file or test deadline changed.

| Final check | Actual result | Evidence / interpretation |
|---|---|---|
| Integrated M1, 32 files | **369 tests: 367 pass, 2 fail, 0 skipped, 0 cancelled; exit 1. Not green.** Duration 311075 ms. | `m1-final-combined-r2/RESULTS.json` and `receipts/m1-final-combined-r2.json`; 2026-10-22 11:23:33–11:28:44 UTC. All MR-01 foreclosure cases passed. |
| Final directed mutation campaign | **15/15 killed** by the intended assertions. | `final-mutations.json`; final safe-integer/epoch source. |
| Runtime typecheck | Exit 0. | `typechecks-final/receipts/runtime-typecheck.json`. |
| Conversations typecheck | Exit 0. | `typechecks-final/receipts/conversations-typecheck.json`. Worker has no typecheck selector; no worker pass is claimed. |
| Two exact failing cases, isolated candidate | **2/2 pass**. | `combined-diagnostics/receipts/candidate-isolated.json`. A diagnostic, not replacement of the integrated result. |
| Same isolated cases with exact-parent registry | **2/2 pass**. | `combined-diagnostics/receipts/parent-isolated.json`; loader substitutes only the exact `86091db0` registry. This is a module replay, not a full pristine-base run. |

The integrated failures are:

1. `parked continued RPC receives the shorter retirement deadline and no later effect dispatches`, in `apps/control/conversations/test/lifecycle-transition.test.mjs`. The existing 220 ms receipt expires before the awaited effect hook is entered, yielding `LIFECYCLE_EFFECT_UNKNOWN` from the pending-operation side of the fixture's race.
2. `resume: a naturally completed successor finishes the committed transition through the production authority`, in `apps/runtime/product-ports/test/lifecycle-continuation-servability.test.mjs`, also `LIFECYCLE_EFFECT_UNKNOWN`. Its default lifecycle operation limit is 3000 ms; total test duration was 4870.824397 ms. Timing is a plausible contributor, but the wrapped error does not prove that root cause.

Both test files and `apps/control/conversations/lifecycle/service.mjs` are byte-identical to the recovered parent. The MR-01 fallback is reached only by historical Stop; these failed calls were lifecycle continuation operations. Isolated candidate and exact-parent-registry passes did not reproduce a semantic regression. At that checkpoint, classification was **unresolved deadline-sensitive integrated failures**; the failed gate is retained. The later deadline-fixture correction below is a separate source result. No assertion, fixture deadline, allowance or production limit was changed to obtain the diagnostic passes. `diagnostic-pins.json` records the exact comparison; the failed combined receipt remains authoritative for that run.


The final 15 directed mutants separately remove event-ID, whole-event-hash,
terminal-kind, terminal-state, binding, scope, missing-custody, valid-time and
cursor-progress guards; replace the timestamp with `now()`; override original or
initial-admission precedence; refuse later pages or epoch zero; and reopen original
preparation. All are assertion kills, not timeouts. Temporary canonical-store
mutations were restored, with zero final store diff. `final-mutations.json` and
`final-mutants/` retain each exact selector, source hash, failure and receipt.
The independent read-only source review found no concrete defect; it is not a
substitute for dot/Fable's final exact-head review.

Retained unsuccessful/intermediate evidence:

- The first 32-file v2 attempt was interrupted without a completed receipt. Its
  evidence adapter mistakenly used 180000 ms, while the historical combined suite
  used 900000 ms and took 333500 ms. After verifying no task-owned test remained,
  the final selection used that original 900000 ms suite cap. No test, production
  deadline or runner changed. No result is inferred from the interrupted attempt.
- The initial cursor mutant starved its frozen-clock fixture and reached the outer
  harness timeout; it is not counted as killed. The fixture now throws on a second
  nonadvancing read and asserts exactly one proof-page read, making its semantic
  failure deterministic without changing production timeouts.
- The prior 60/60 focused result predates the final safe-integer/epoch correction;
  the final integrated source pins govern the published behavior. Earlier mutation
  runs are retained separately, not added to the final 15.
- An exact-parent registry replay with candidate tests recorded 17 tests, 11 pass
  and 6 fail: four valid foreclosure receipt cases still returned the old 503, and
  two page-boundary tests observed no proof read. This is targeted old-source
  regression evidence, not a pristine-base suite or final-candidate failure.
- Historical 344/345, inherited public provenance failures and EX-06's exact-base
  1775 pass / 10 fail / 6 skip remain above. The isolated recoveries do not erase
  those receipts. The five remaining EX-06 deadline-sensitive findings are not
  declared flakes; twelve additional control files confirmed in lane R remain
  unrun under the recovery allocation.

`resume-inspection.md`, `combined-interruption.md` and
`cursor-mutation-interruption.md` retain rerun reasons. The authoritative restored
pins are `final-restored-source-pins.json` and
`m1-final-combined-r2-source.json`; the earlier `final-test-source-pins.json` was
captured during mutation and does not pin the restored registry.

| Final production/test source | SHA-256 |
|---|---|
| `apps/runtime/prepared-run-registry.mjs` | `3edbcf69176f082eec0e1a8fa34ecadd1f9377e40e80ad1a468065a5928ef429` |
| `apps/runtime/test/historical-stop-custody.test.mjs` | `bf7439ef2181a203ba97a0f064ab0801e41702980cdfbcebf7461b9c194bc5a6` |
| Unchanged `apps/control/conversations/postgres-store.mjs` | `e496b788cca732d5530ef79b2d5b17153072fbb25d35dd50213c8cb6bb40d1d1` |

The final combined selector is the historical 31-file list above plus
`apps/runtime/product-ports/test/lifecycle-continuation.test.mjs`, deduplicated to
32 files. The existing EX-06 `run()` owner executes them under its environment
scrubber and subreaper, using `--experimental-test-module-mocks`,
`--test-concurrency=1` and its recorded reporter arguments. The evidence-only
adapters select suites; they do not replace or change the runner:

```sh
node /dev/shm/agent1-v2-m1-evidence/run-final.mjs
node /dev/shm/agent1-v2-m1-evidence/typechecks-final.mjs
```

The combined receipt records all child/wrapper arguments, exact file selectors,
UTC times, root UID, source dirty state and output hashes. All 32 test hashes and
the two production-source hashes are recorded before execution and rechecked
before publication. Five lockfiles remain unchanged. Only prose changes after
that source check. No root-host or scripted-port result closes native PostgreSQL,
physical task/grant, installed SDK/CLI, image, current identity or live UI gates.
MR06/X1 public facade/contracts/frontend and MR09/E40 accounting remain the named
owner handoffs above. This bounded MR-01 source correction is not full M1 release
acceptance, a ship request, or authorization for merge/deploy/SQL.


## M1 integrated deadline-fixture correction after `4109aadd`

Direct Neo continuation requires correcting the two failed integrated cases while
preserving deadlines and negative coverage. The two canonical-composition suites
mixed real host time with semantic authority time: the short-RPC matrix required
ownership/journal work to reach a parked hook inside 220 ms, and natural-successor
cases assumed their entire scripted composition would fit the default 3000 ms
operation. Correct refusal after expiry then appeared as a positive-case failure.
Controlled host delays reproduced both old failures; a process-local diagnostic
loader exposed inner `DEADLINE`, without editing production source. The original
integrated errors did not preserve that inner cause, so this reproduction is the
bounded diagnosis of the fixture defect, not a claim to recover missing telemetry.

Only these two test files and this ledger change after the MR-01 publication:

- `apps/control/conversations/test/lifecycle-transition.test.mjs`
- `apps/runtime/product-ports/test/lifecycle-continuation-servability.test.mjs`

Node's test-context Date/setTimeout control now owns semantic time throughout each
of these scripted suites. Test contexts reset it after each case. Canonical session,
journal, authority, store, lifecycle service and Temporal adapter are still composed
unchanged. Existing cancellation, revocation, corruption, wrong-purpose, lost-ACK,
retirement and no-extra-effect cases remain. No production clock, bound, dependency,
runner, contract or manifest changed.

The six parked-RPC cases retain the 220 ms limit, existing 5000 ms test timeout and
all original assertions. They now verify no abort at 219 ms and abort exactly at
220 ms; late ACK and historical replay still cannot produce another effect. The
original 1500 ms outer wall-time ceiling is additionally checked with independent
`performance.now()`, so test-owned Date does not turn that wall bound into a virtual
assertion. Three new cases expire target/admission/retirement authority before
dispatch and require zero starts/continued calls, UNKNOWN and effect-free replay.
Four new resume/fork cases require completed targets to finish at 2999 ms and
refuse at exactly 3000 ms, preserving durable UNKNOWN and no extra replay effects.
Natural completed/failed positive cases explicitly advance semantic time by 1 ms.

A TypeScript AST comparison, using the repository's existing runtime toolchain,
verifies every original assertion expression remains: **94→106** in the transition
suite and **126→134** in the servability suite. These are static assertion sites,
not distinct test counts. Seven new generated test identities are added. The
unchanged real-clock lifetime/worker suites remain in the full combined selection;
these synthetic suites are not a host-throughput or live-provider qualification.

| Check | Result | Evidence / limit |
|---|---|---|
| Final integrated selection, unchanged 32 files | **376/376 PASS; zero failed/skipped/cancelled; exit0.** Duration 459854 ms. | `m1-deadline-combined/RESULTS.json`, `receipts/m1-deadline-combined.json`; 2026-10-22 12:54:15–13:01:55UTC. This includes every original case plus seven new boundary cases. |
| Exact-boundary focused baseline | **13/13 PASS**. | `mutations/BASELINE/`; both sides of220ms/3000ms and pre-dispatch expiry. |
| Final modeled faults | **7/7 killed by intended assertions**; no timeout/cancellation counted as a kill. | `final-mutation-summary.json`; partial surviving injections are separately retained below. |
| Controlled host-latency reproduction | Old fixtures **0/2**; corrected clock fixtures **2/2** with the same delays. | `old-host-delay/` and `fixed-host-delay/`. Exact source/loader chronology retained; later additions strengthen assertions. |
| Runtime/conversations typechecks | **Both exit0**, two suites passed. `typechecks/receipts/runtime-typecheck.json` and `typechecks/receipts/conversations-typecheck.json`. | Existing npm selectors; no worker typecheck selector invented. |

The final combined run uses the original 32-file selection, declared module-mock
flag, concurrency1, existing EX06 runner/environment scrubber/subreaper and unchanged
900000ms harness cap. No name filter or exclusion is used. All production and test
hashes were pinned before the run and checked unchanged afterward. Only this ledger
changes after execution. The original 367pass/2fail and 344pass/1fail combined receipts
remain historical outcomes, with no silent replacement or claim that isolation
alone qualified them. The new full combined pass follows the demonstrated fixture
correction and strengthened boundary coverage.

```sh
node /dev/shm/agent1-v2-m1-deadline-evidence/run-combined.mjs
node /dev/shm/agent1-v2-m1-deadline-evidence/typechecks.mjs
```


The directed faults remove target/admission/retirement deadline propagation,
remove timer delivery, reorder dispatch before current proof, or move the composed
service/session ceiling by one millisecond in either direction. All injection is
per-process loader source; production files remain byte-identical to `4109aadd`.
Two partial mutations survived because independent defenses still enforced the
bound: changing only the service default left the session-owner ceiling intact;
removing only timer rescheduling left the Temporal dispatcher's fresh timer intact.
These are retained as survivors, not counted as kills. The final compound faults
remove both relevant defenses and are caught. Baseline/mutation/file-placeholder
counts are not added to the integrated result.

Retained development evidence includes the first focused result **35 pass/3 fail**:
two adjacent positive cases exposed the same wall-clock assumption, and a new fork
replay assertion incorrectly demanded rejection instead of allowing an inert UNKNOWN
receipt. The latter assertion was corrected before publication; the new test still
forbids APPLIED and every extra effect after expiry. The next focused result is
**38/38**, followed by adding the two just-before-boundary witnesses and the
independent wall assertion; final combined pins govern the published tests. No
failed receipt or original 367/369 outcome is erased. Evidence-only root TypeScript
resolution initially failed; the AST check then used the already-installed runtime
copy, with no dependency installation.

New evidence: `/dev/shm/agent1-v2-m1-deadline-evidence/`; the original evidence at
`/dev/shm/agent1-v2-m1-evidence/` and recovered old checkout remain preserved.
`old-host-delay/`, `fixed-host-delay/`, `mutation-results*.json`,
`mutation-boundaries.md`, `assertion-preservation.json`,
`final-test-source-pins.json` and the combined receipt retain exact selectors,
source hashes, failure traces and rerun reasons. Earlier mutation results preceded
only the additional monotonic wall assertion; that assertion strengthens the final
candidate and is exercised by the combined run. No test is rerun merely to replace
a failed receipt with a pass.

P1 remains held until #205 merges and its explicit dependency gate clears. C9 stays
with agent 2, stacked on P1 under decision6339760482. #207's completed manifest rebase
at `5a9c0b16b28da77ab59ffb0498a2d703aa36b141` is not repeated. MR06/X1 public
contracts/frontend, MR09/E40 accounting, broader legacy custody and native/image/
identity/live qualification remain their existing owner gates. This source check
introduces no merge, deployment, cloud or real SQL execution authority.

Final tested fixture hashes:

| File | SHA-256 |
|---|---|
| `apps/control/conversations/test/lifecycle-transition.test.mjs` | `f9b44875a8d12941f3542f805ce0a1a6eed617e26215fed5d3b1c29d36cd27d5` |
| `apps/runtime/product-ports/test/lifecycle-continuation-servability.test.mjs` | `bb5ddec833ffcfd9767d3d8f734010a59ad552173ca82ea2bf208bc2f2ab8cc0` |


## Post-#205 M1 integration checkpoint

[Fable's revised order6341932764](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6341932764)
and explicit [#205 merged notice6342277568](https://github.com/neo-capiro/meri-greenfield/issues/202#issuecomment-6342277568)
supersede the historical P1-before-M1 hold. GitHub independently records #205 merged
at2026-10-22T13:43:48Z and main `d3cf54962a954daf4382df535a9c518aff791b0e`, tree
`2281bed7585bd6515b46503e66e80f118fee79cf`. M1 now precedes P1; C9 remains stacked
on P1 with agent2 ownership.

All18 commits through reviewed #204 `046048cb4461a1e2876ecb60ed9c2d2c94f9a9ef`
rebased cleanly onto that exact main. The incoming main and M1 changed-file sets
have no overlap; range-diff preserves all18 patches. Direct blob comparisons verify
all existing M1 source/test bytes and incoming P2/provenance bytes before generation.
No runtime edit or conflict resolution was added. The only generated delta is
`packages/contracts/dist/conversation-lifecycle.metadata.json`: the existing
lifecycle service source hash changes `dd12fcd10e43…`→`d3c7eeafcfb5…`, and its byte
length26703→27033. Other metadata fields, schemas, browser JavaScript, declarations,
package versions, generators, dependencies and lockfiles remain unchanged.

Generation uses only `node packages/contracts/generate-lifecycle.mjs`, followed by
that same generator with `--check`. All155 source-provenance rows across11 metadata
families match actual source bytes/hashes. No other family was regenerated, and
no hash was edited by hand. Source qualification head before this ledger-only
update is `2826e0c9b10177a2113bc9c3ba7c458d16a58f47`.

The unchanged combined run on source head `2826e0c9` completed with **376 tests,
373 passed, 3 failed, 0 skipped/cancelled** (541143ms; started
2026-10-22T13:55:36.798Z). This is a failed gate, not a green qualification.
The retained failures are `readReceipt rejects foreign principal, client, scope,
control and full source binding selectors` (`DEADLINE`), `readReceipt refuses
recomputed-hash source, target and conversation custody corruption`, and
`readReceipt caller cancellation withholds a receipt before and during discovery`
(the latter two `LIFECYCLE_EFFECT_UNKNOWN`). Every stack originates in the
`resumed()` fixture setup before the receipt assertions. The first expires during
pause/claim setup; the latter two fail the positive resume setup. Their observed
wall durations are3217ms,8276ms and5488ms. Fixture deadline expiry under host load
is the leading explanation; this checkpoint does not establish a product defect
or classify the failures as waived. No rerun, deadline change or extra test edit
was made to obtain green. The raw output and failure receipts are retained.

The existing `test:public` passed **506/506**, with no skipped/cancelled tests.
Contracts declaration, runtime and conversations typechecks each exited0.
The lifecycle generator final `--check` exited0. The reviewed correction's two
previously failing test identities pass in this run; the three newly observed
fixture failures remain open for review and bounded correction. This ledger-only
update changes no qualified source, test or generated bytes.

The existing32-file selector and376 test identities are preserved, with the same
module flag, serial concurrency, EX06 runner/scrubber/subreaper and900000ms combined
cap. `test:public` executes the existing package script without a name filter,
assertion/skip change or generator side effect. Root UID0 and Node24.19.0 are
recorded. TMPDIR points to a task-owned `/dev/shm` directory because the overlay
filesystem is full. No product/native SQL, cloud action or new dependency is used.

The first generator check exposed local tool-layout drift: borrowing dependencies
through an external symlink made esbuild embed those external paths in bundle
labels/browserInputs. This was not a source or contract change. Its output and
failure are retained. Exact already-installed dependency bytes were materialized
under this checkout, as in #205, and the generator reran. The original symlink is
preserved outside Git. Final generation leaves the browser bundle byte-identical
to main and changes only the lifecycle service provenance row. Tool versions remain
Ajv8.20.0, ajv-formats3.0.1, esbuild0.28.2, json-schema-to-typescript16.0.0 and
TypeScript5.9.3. No installer, generator modification or hand-edited artifact is
used to normalize the output.

Evidence: `/dev/shm/agent1-v2-m1-post205-evidence/`, including
`source-reconciliation.json`, `range-diff.txt`, `generated-delta.json`,
`provenance-source-audit.json`, generator outputs/checks, `candidate-source-pins.json`
and unchanged-runner receipts. All earlier failed and successful checkpoints remain
historical evidence; the #205 merge resolves the inherited public provenance drift
recorded above, while this generation closes only M1's lifecycle source delta.

Exact-head re-review remains required for the rebase/provenance delta. Fable then
owns image build/measurement, first-turn/D3 rehearsals, native PostgreSQL custody
trigger proof and M1 release. Existing cross-owner feature handoffs remain explicit.
P1 starts only after M1's gates and release; agent2 retains C9. No #207 rebase,
acceptance turns, duplicate qualification runner, merge, deployment or SQL execution
is performed in this checkpoint.

## Receipt-readback setup deadline correction after7206cff1

The retained post-#205 result above remains373/376, not waived. dot's source
review6342913751 accepted only the rebase/provenance delta and held shipping.
This follow-up changes only
`apps/control/conversations/test/lifecycle-receipt-readback.test.mjs` and this ledger.
It does not rebase again or edit runtime/generated/contract/other-owner files.

The failures occur before receipt assertions: the selector case in `resumed()`'s
claim setup (`DEADLINE`), and the corruption/cancellation cases in continuation
setup (`LIFECYCLE_EFFECT_UNKNOWN`). A controlled load-hook reproduction injects a
3100ms synchronous scheduling stall during claim or dispatch-start authorization.
On the original fixture, measured wall/semantic elapsed pairs are3117/3118ms,
3127/3127ms and3199/3199ms. All three original identities fail, and instrumentation
reveals inner `DEADLINE` for both UNKNOWN results. This demonstrates a sufficient
failure mechanism and the fixture's host-time dependency; original receipts do
not contain inner timing telemetry, so this does not reconstruct the exact host
schedule of the historical run.

The receipt suite now uses the same Node test-owned Date/setTimeout convention
as the reviewed lifecycle composition suites. Each test owns and automatically
restores its timers. The same injected real stalls measure3107ms,3126ms and3101ms
with zero semantic elapsed, and all three original tests pass their unchanged
negative assertions. No production lifetime or authority deadline changes.
All original test/helper body bytes and27 static assertion sites are preserved;
there are44 sites after adding six boundary cases. The same32 combined files
remain selected; six new test identities increase the expected total376→382.

New cases advance semantic time inside the claim query or transition-context
read, with real service/journal/owner compositions over scripted SQL. Claim,
resume and fork each succeed at2999ms and refuse at3000ms. An expired claim stays
PENDING; expired continuations stay UNKNOWN and start/continue no workflow.
Readback and control replay preserve UNKNOWN without another effect. This is not
PostgreSQL/native/physical-stop proof. All existing foreign identity/client/scope,
recomputed custody, write-refusal and caller cancellation assertions remain.

The first focused development run was11/13: the two new expiry cases incorrectly
expected control replay to reject. Canonical `control()` explicitly returns the
durable UNKNOWN replay receipt. Only those new expectations were corrected to
UNKNOWN, preserving unchanged effect counters; the corrected suite is13/13.
Both outcomes remain in evidence. Original combined/development failures remain
visible and are not recategorized as passes.

Four loader-only modeled faults are caught by their intended assertions: disabling
receipt selector refusal, bypassing continuation-custody execution validation,
discarding caller cancellation, and shortening the lifecycle bound3000→2999ms.
The first three kill the corresponding original negative test; the short-bound
fault kills all three new2999ms positive cases. No mutation is a product edit.

The final combined attempt on the source qualification commit used the unchanged
32-file selector, flags, concurrency1, scrubber/subreaper and900000ms cap. It
**timed out after900208ms**, exit null, signal SIGTERM, with no final Node summary
(started2026-10-22T14:27:16.114Z). This remains a **failed/incomplete gate**.
The parser's empty counts do not mean zero tests ran: raw output has173 pass lines
and8 failure lines. All13 receipt cases pass in that output. The eight observed
failures are five parked RPC cases (start target/admission; continued target/
admission/retirement), both image-only-deploy continuation positive cases, and
the stopped-source conversation-survives-deploy case. Full stacks are absent
because Node had not printed its final summary before timeout. Their cause is
not established or waived. The five parked cases retain their220ms semantic
cutoff,5000ms test timeout and independent1500ms wall bound. No deadline or
assertion is relaxed, and no green-seeking retry is run. Tests not reported
before timeout remain unqualified. This result supersedes no historical failure
with a pass: it confirms the receipt correction locally while leaving the
combined gate held for triage and qualification.

Evidence: `/dev/shm/agent1-v2-m1-receipt-evidence/`, including the implementation
outline, original fixture snapshot, before/after delay receipts and loader,
`delay-comparison.json`, assertion preservation, focused development results,
mutation sources/results and final combined receipt/source pins. Instrumentation
and modeled faults are loader-only and are not product edits.
Source qualification commit is `924195af666f253c9e47fcdbc44dd2cad19e1f90`;
subsequent ledger-only commit has identical runtime/test/generated bytes.
Existing public506/506, three typechecks and provenance checks from the preceding
checkpoint cover unchanged product/generated bytes; they are not duplicated here.

Exact-head delta review and all Fable image/native/rehearsal/release gates remain.
M1 ships before P1; P1 stays held, and agent2 retains stacked C9 ownership.
Existing MR06/X1 public-facade and MR09/E40 accounting/settlement handoffs remain.
No acceptance turn, new dependency/credential, merge, deployment, AWS or SQL
execution is performed by this follow-up.
