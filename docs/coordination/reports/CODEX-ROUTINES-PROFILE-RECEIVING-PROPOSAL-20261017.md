# Scheduled occurrence profile: receiving proposal, not received

This is a source design and local verification record. The prepared-run and whole-facts owners have not received this patch. No shipping facts hash, runtime activation, database qualification, grant issuance, provider execution or deployment is established here. Apply the proposal only against the final successor accepted by the first-chat/prepared-run owner; do not edit a shipping candidate from this document alone.

## Ownership and implementation outline

Baseline: `de58c7e6fb842e8c7fb5b5165a44ccdea45be053`, branch `codex/meri-routines-occurrence-semantics-task6-20261017`. Concurrent owner changes are present in the shared task checkout. This slice owns only:

- `apps/runtime/native-authority/scheduled-run-profile.mjs`
- `apps/runtime/native-authority/test/scheduled-run-profile-fixture.mjs`
- `apps/runtime/native-authority/test/scheduled-run-profile.test.mjs`
- This report.

The implementation outline was recorded with the coordinator before edits: read canonical occurrence custody; reuse the single scheduled-job lineage owner; seal the private scope through its budget parser; restrict cost/expiry without rewriting an approved manifest; verify original and resumed runs, uncertainty, cancellation and inert boundaries. No new persistence, allocator, lineage traversal or authority implementation belongs to this helper.

Canonical owners reused:

- `createPostgresScheduleOwner().readOccurrenceForConversation`: immutable local occurrence custody. Positive custody cannot fall back to an ordinary Core conversation on malformed or foreign data.
- `snapshotScheduledJobSelection` and `createScheduledJobLineage`: deterministic origin and the canonical same-work resume chain. The helper requires `occupiedReason === null` and exact `currentBinding`; `cleanupReady` and historical binding membership alone never permit a fresh profile.
- `assertOriginalInputAcceptance`, through the lineage owner: original accepted `allocatedAtMs` and `expiresAtMs`, unchanged on resume.
- `assertOccurrenceCostScope` and `allocation`: the one private scope/parser and complete allocation validation. Budget owners enforce shared actual/UNKNOWN liability across run IDs under the existing lock.
- `createOperationLifetime`: bounded reads, cancellation, post-await checks and owned timer cleanup. Borrowed stores/pools are never disposed.

## Implemented private interface

`createScheduledRunProfile({ scheduleOwner, store, task, selectedClientId, allocationJson, maxCostMicroUSD, now, maxRequestMs? })` constructs inertly. The task must come from the trusted configured scheduled-task template, including its task ID/version and manifest hash; it is not a UI or model hint.

`read({ binding, scopes, expiresAtMs, deadlineMs, signal? })` returns `null` only for a twice-confirmed absent local origin, leaving the normal path to its existing owners. A pre-existing private scope cannot disappear through that fallback. Otherwise it returns recursively frozen:

```js
{ allocationJson, allocationSha256, maxCostMicroUSD, expiresAtMs, occurrenceCostScope }
```

Fresh scheduled profiles require a positive canonical `OPEN` occurrence, exact tenant/actor/client/task/scopes, an accepted root or explicit verified same-work resume, and an executable current run. A fork, new-prompt reservation, unresolved/UNKNOWN control, historical target, missing run, closed custody, changed read snapshot or expiry refuses. Read snapshots are repeated before release. This is a restriction, not current policy or execution authority; existing policy/currentness/retirement checks still apply at their canonical boundaries.

`occurrenceCostScope` contains the canonical occurrence key, full original writer-fence-one binding and **exact approved occurrence cap**. The group cap does not change when a narrower runtime profile is selected. The runtime cap is the minimum of configured profile cap, approved manifest cap and occurrence cap. Allocation manifest/budgets remain unchanged; changing budgets alone would violate their canonical equality and approved manifest hash. The complete target allocation JSON includes the scope before parsing/hashing.

Expiry is the minimum of the supplied fixed issuance expiry, original accepted expiry, original accepted allocation time plus occurrence maximum runtime, and charge-schedule expiry. It is never computed as a renewed resume window. Expired profiles cannot issue fresh material.

## Proposed receiving patch: root-exclusive, still unreceived

Observed source fingerprints are Git blob IDs, not deployment or facts hashes:

- `apps/runtime/prepared-run-bindings.mjs`: `92e2df761fd9a4c481af4b3e89d3e2dba21ad646`
- `apps/runtime/prepared-run-issuance.mjs`: `a89195ac852791940422a4cf1f2b0fbb3468829c`

Re-read the final owner-accepted successors before preparing a patch. The required receiving changes are cohesive at these existing seams:

1. **Trusted composition / optional profile port.** Construct this helper from the configured task template, schedule owner, canonical conversation store, existing allocation JSON, configured runtime cap and clock. Add a default-absent private port to prepared-run composition. No-origin follows unchanged existing behavior; positive-origin refusal propagates and cannot select a fallback. Caller scopes come from the exact canonical saved run, not supplied browser metadata.

2. **Expiry selection before issuance.** At `issuanceIntent` and original/dynamic-original preparation, resolve the candidate profile before establishing the immutable issuance intent. Use its fixed expiry. An existing issuance retains its exact stored expiry; a mismatch refuses instead of reissuing or widening it. The scheduled original acceptance already pins the approved original window.

3. **Preflight at the actual issuance boundary.** Current `createPreparedRunIssuance.prepare` calls `issuer.issue` before `facts.compile`; the task grant is therefore already issued when the model-grant path starts. Merely adding the resolver inside `facts.compile` is too late. Add a trusted optional preflight before any new `issuer.issue`, after the existing source-retirement checks and before capability material generation. It must validate that the complete intent expiry equals the admitted profile expiry, match its request hash to the exact canonical saved request, and preserve the same immutable selected profile through subsequent compilation/rechecks. Keep the existing uncertain-claim/idempotent issuer semantics and source retirement checks. The precise port and any whole-facts schema additions belong to the prepared-run owner.

4. **Model issuance and raw facts.** In `facts.compile`, recheck the same canonical selected profile before `issueRunModelGrant`. Supply the sealed allocation JSON, returned runtime cost cap and fixed expiry to the raw configuration. Apply that exact configuration to `compilePreparedRunFacts`, native allocation admission and the task allocator. No runtime-only cap patch is sufficient. Keep task/model grants and runtime deadline identical to the immutable issuance expiry. Keep configuration/workspace/client/current-policy checks intact.

5. **Replay and reconstruction.** `resolveFacts` must reproduce the exact scoped allocation and restricted runtime profile, then require equality with the existing issuer `factsSha256`. Do not change an old issuer row or whole-facts schema implicitly. The normal absent-origin facts must remain byte/canonically equivalent under the owner's chosen version. A process-local profile cache is not durable evidence.

6. **Admission and historical retirement.** Replace the unconditional static `retarget(binding)` use at `admissionFor`, `admissionForBinding`, source-owner revocation and `retireInitial` with the exact selected/retained scoped allocation. Historical cleanup must not call this fresh resolver: an old source is intentionally no longer the current target, and cleanup must still work after expiry or occurrence settlement. Current conversation allocation records carry `allocationSha256`, not full allocation JSON. The receiving owner must obtain or deterministically reconstruct the original scoped allocation from existing canonical retained custody/allocation data, validate complete bytes with `allocation()`, and compare its hash with the durable allocation record and immutable issued whole-facts digest before reconstruction. Preserve original expiry, grants, task request hash and allocator intent. Do not drop the scope, renew expiry, recompile current facts, open model credentials or issue anything during cleanup. Refuse missing/conflicting evidence.

7. **All whole-facts consumers together.** Audit first-chat, original/dynamic original, same-work resume, admission, source revocation, poststart/runner delivery and retirement reconstructors against the final owner-accepted whole-facts version. No new run schema field, DDL, table or allocator is proposed. Budget totals remain in existing allocation/liability owners. The receiving owner must independently test the integrated successor before publication/activation.

The smallest useful receiving sketch is therefore a single private profile selection used by expiry selection and a pre-issuance guard, then passed consistently through facts and admission, with a separate historical reconstruction path for cleanup. This report deliberately does not claim that these owner-exclusive edits have landed.

## Verification

Run from the repository with Node 24:

```powershell
node --test apps/runtime/native-authority/test/scheduled-run-profile.test.mjs
node --check apps/runtime/native-authority/scheduled-run-profile.mjs
node --check apps/runtime/native-authority/test/scheduled-run-profile-fixture.mjs
node --check apps/runtime/native-authority/test/scheduled-run-profile.test.mjs
```

Focused final behavior: **30/30 pass**. The pure fixture composes actual canonical schedule custody, original binding/input journals, conversation store and explicit checkpoint/resume lifecycle over scripted SQL and synthetic policy boundaries. It creates no database/server/provider process.

All three owned JavaScript files pass `node --check`. A broader run including `scheduled-job-lineage.test.mjs` and `scheduled-admission.test.mjs` returned **94/95 pass**: all 29 profile and 11 lineage cases passed. The remaining existing admission test, `configured destination mismatch never silently broadens or substitutes a profile` at `scheduled-admission.test.mjs:80`, constructed a now-invalid destination configuration synchronously before its `assert.rejects` boundary. The concurrent admission owner now refuses that configuration at construction. This outside-owned-path assertion-boundary mismatch was reported to the coordinator; this slice did not edit its source, gate or assertion.

After the final identity string guard, the focused combined profile/lineage run passed **41/41** (30 profile plus 11 lineage), with no skipped or cancelled cases. All four allocated files passed byte-level LF, trailing-whitespace/EOF and Git-filter-equivalence checks, including the untracked files; the coordinator still owns staging and the final staged whitespace check.

Coverage includes sealed bytes/hash and unchanged manifest; invariant occurrence cap under narrower runtime profiles; actual resume retaining origin/expiry; originally shorter authority expiry after policy widens; charge-schedule/issuance limits; absent/appearing/disappearing custody; OPEN-only eligibility; actor/client/task/scope/run mismatches; rehashed foreign effect; changed private cap; pending/DISPATCHING/UNKNOWN resume; fork/new prompt; missing admitted root; deadline/abort and eventual pending read drain; inert constructor/request facets, rejected non-string identity without coercion, and sanitized thrown proxies.

Earlier runs were 19/26 then 25/26. They found this author's initial full-binding argument to the now-closed four-field scope parser and a fixture that assumed foreclosure after claiming an allocation. Both were corrected; no production gate or assertion was weakened. Additional lifetime/expiry tests brought the count to 29. Final self-review then found a missing string guard before the constructor's client-identity UUID test, which could coerce a supplied object. The helper/test freeze was explicitly reopened, the guard and zero-coercion regression added, and the final count is 30.

Remaining qualification: independent source review, owner receiving patch, integrated whole-facts/replay/retirement tests, real PostgreSQL and live runtime qualification. None is replaced by these local synthetic checks. No install, migration, AWS, live credentials or shipping-pin change occurred in this slice.
