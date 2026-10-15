# Fable lane r4-l4-restart — 15 October 2026

Branch `fable/r4-l4-restart-20261015`, base `81e20025` (package three). This lane closes the two L4 HOLD items in `PACKAGE3-LIFECYCLE-REVIEW.md` (reviewed at `f8d1816e`):

- **L4-1**: a hard control restart has no stop-only recovery owner.
- **L4-2**: failure or Stop before allocation cannot admit the next prompt.

No deployment, cloud, credential, provider, migration, lockfile or contract change was made. The design needs no schema change.

## Implementation outline (recorded before the change)

- **Owners are unchanged.**
  - The store's locked transition (`appendEvent`) remains the only terminal writer.
  - The allocation journal and the canonical allocator (`stop` = revoke, ECS containment, then `RETIRED`) remain the native stop owner.
  - The prepared kickoff's `stop` remains the broker's independent exit.
  - The run reconciler settles only on journal evidence.
  - The next-run owner and journal own admission.
- **L4-2 design: no-authority evidence.**
  - A queued run that turns `failed` or `cancelled` with no allocation row gets a `FORECLOSED` record. The store writes it into the run's own `native_allocations` row, in the same transaction as the terminal transition.
  - That transaction already holds the conversation advisory lock.
  - Afterwards, a late claim is refused three ways: the claim's queued-state check fails, the row is occupied (primary key and `intent_key`), and the existing update trigger refuses any update of an unknown state.
  - The next-run journal admits a failed or cancelled source on `{checkpoint:null,noAuthority:{foreclosureSha256}}`. It re-verifies that against the row under the lock.
  - A missing row is never evidence. A claim that committed first leaves no evidence and still needs retirement and revocation.
- **L4-1 design: stop-only retirement.**
  - `createOriginalRetirement` lives in the hashed `remote-composition.mjs`, which now shares one allocator builder.
  - It is rebuilt from the exact durable allocation facts and exposes only `stop`.
  - Lazy controllers gain `retire()`. The kickoff's reconciler calls it after the memoized close, as a fresh attempt on every reconciliation. This is the re-entry path.
  - The registry's restart stop route builds a stop-only entry.
  - There is an operator one-shot. There is no background loop.

## Findings closed

### L4-1: restart stop-only owner (commit `08410b68`)

- **New `createOriginalRetirement`** (`apps/runtime/native-authority/remote-composition.mjs`).
  - It compiles the original from the same runtime, plan and preparation facts.
  - It builds the canonical allocator and admission with a pre-allocation authority that refuses. `allocate` is not exposed.
  - It refuses with `ALLOCATION_REPLAY_REFUSED` when the journal record (minus state and resource) differs from the rebuilt intent.
  - It refuses with `ALLOCATION_UNKNOWN` when the row is absent or `FORECLOSED`.
  - An already-proven `RETIRED` record returns without repeating effects. Otherwise it calls `allocator.stop()`, which records `RETIRED` + `physicalStopProven` only after both revocation and containment are proven. Any uncertain step records nothing.
  - `allocateRemoteNativeController` uses the same `originalAllocator` builder; its behaviour is unchanged.
- **Candidate** (`prepared-candidate.mjs`) and **registry** (`prepared-run-registry.mjs`) lazy controllers gain `retire({signal})`.
  - It forecloses further allocation in that process, then asks the stop-only owner.
  - The candidate builds the owner from its static configuration. The registry builds it from the exactly replayed issuance facts.
  - An optional `retireOriginal` factory is injectable, like the existing `allocate`.
- **Kickoff** (`prepared-kickoff.mjs`).
  - The reconciler's retirement first runs the kickoff's own memoized close (errors swallowed), then `controller.retire()` when one is offered.
  - With reconciliation, `stop` rests on the reconciler's journal outcome rather than on close. `unknown` is still `KICKOFF_UNKNOWN`.
  - Without reconciliation, behaviour is unchanged.
- **Registry restart stop route.**
  - Builds a stop-only entry that may serve an already terminal target whose original was never retired. Before, such a target was refused, which would block its successor forever.
  - The entry never kicks off: `allocate` refuses.
- **Durable re-entry.**
  - Every later `execution/kickoff/stop` (the broker, the workflow's reconcile activity, a fresh process) is a fresh bounded attempt over durable state.
  - New `apps/runtime/reconcile-run.mjs` makes one bounded `execution/kickoff/stop` for one binding and exits 0, 3 (UNKNOWN) or 2. No loop.
  - The `recovery-workflow.ts` comment names both paths. The workflow logic is unchanged and still rethrows the original failure.
- **Found in passing.** The registry refused the production `issuanceIntent` shape `{expiresAtMs,persisted}` (closed `own`). Because the restart stop route depends on that build, it is fixed: `persisted` is an optional boolean, and any other field is still refused. Regression added.

### L4-2: no-allocation successor (commits `7f9969e8`, `bc6b3909`)

- **`native-preparation-journal.mjs`**
  - `FORECLOSED` record type (`binding`, `allocationKey`, `foreclosure:{eventId,eventSha256,state}`), plus validators.
  - In-transaction `foreclose(c,binding,event,check)`.
  - `claim` refuses a foreclosed run with `NATIVE_PREPARATION_STATE_REFUSED`.
  - Conversation exclusion treats a valid `FORECLOSED` row as not live.
  - `record` refuses unknown states.
- **`postgres-store.mjs`**: `appendEvent` calls `foreclose` for `queued` → `failed` or `cancelled`. This covers the reconciler, worker publication and both cancel paths.
- **`run-reconciler.mjs`**: `FORECLOSED` means nothing to stop.
- **`next-run-journal.mjs` and `next-run.mjs`**
  - New `foreclosure(binding)` read.
  - `reserve` accepts `noAuthority` facts only against a `FORECLOSED` row with that exact hash, the source binding and the source's terminal state.
  - `selectRun` uses the evidence for failed and cancelled sources. Otherwise the retirement and revocation path is unchanged.
- **Downstream acceptance**: `prepared-run-issuance.mjs` and the registry accept a source named by that evidence (re-read and exact). Nothing is revoked, because no task, admission or grant ever existed.
- **Grant disposition.** Budget grants are created only by admission, after `RunTask`, after a claim.
  - A foreclosed attempt can never claim, so it never has grants. The real allocator test shows zero `RunTask` and zero `admit` calls.
  - An issuance capability prepared for a target before its claim authorizes nothing without an admitted allocation: bootstrap and task routes require the controller.
- **Visible limitation, unchanged and stated.** A successor of a failed or cancelled source starts a fresh SDK session. Earlier turns' model context is **not restored**. Durable conversation history continues; that is a different claim.

## Tests (all synthetic; scripted SQL protocol fixture)

### New and changed tests

| Test (file) | Cases | With the fix reverted |
|---|---|---|
| `apps/control/conversations/test/no-authority-successor.test.mjs` (new): both review reproductions, missing row refused, claim-vs-terminal race over 24 interleavings with both outcomes observed, existing authority still needs retirement and revocation | 5/5 | Control fix files restored to base: **5 fail**. Both reproductions fail with the review's code `NEXT_RUN_RETIREMENT_REQUIRED`. Mutations: dropping only the store's `foreclose` call fails 4; dropping the claim's `FORECLOSED` refusal fails 3. |
| `apps/runtime/test/restart-retirement.test.mjs` (new): real candidate, kickoff, reconciler, store, journal, canonical allocator and stop-only owner, with scripted ECS and admission | 5/5 | `prepared-kickoff.mjs` restored: **4 fail** with `PREPARED_CANDIDATE_REFUSED` (the kickoff's `KICKOFF_UNKNOWN`). The review reproduction is among them. The uncertain-stop barrier test passes before and after, as expected. |
| `apps/runtime/native-authority/test/original-retirement.test.mjs` (new): stop-only owner over the real allocator; exact-facts refusal; uncertain stop or revocation stays UNKNOWN then resumes; absent or foreclosed has no effect; a foreclosed run never allocates (zero `RunTask` and `admit`) | 5/5 | Base `remote-composition.mjs` has no `createOriginalRetirement`, so all 5 fail at import. |
| `apps/runtime/test/prepared-run-registry.test.mjs` (+5): restart stop of an ALLOCATED target with exact replayed facts and zero allocation; re-entry after two UNKNOWN stops; terminal target; foreclosed source exact or refused; production `persisted` intent shape | 18/18 | Registry restored: 5 fail. With only the kickoff restored, 3 registry cases fail. |
| `apps/runtime/test/prepared-run-issuance.test.mjs` (+1): foreclosed source accepted exactly, four refusals | 34/34 | Issuance restored: 1 fails. |
| `apps/runtime/test/reconcile-run.test.mjs` (new): operator one-shot | 2/2 | — |

The scripted fixture now enforces the `native_allocations` primary key and `intent_key` uniqueness, as PostgreSQL does.

### Suites (Node v24.21.0, UID 0)

| Suite | Base `81e20025` | Branch | Failing at both |
|---|---|---|---|
| `apps/control/conversations` `node --test test/*.test.mjs` | 222 tests, 213 pass, 9 fail | 227 tests, 218 pass, 9 fail | The same 9 PostgreSQL files (see below) |
| `apps/control/conversations` `tsc --noEmit -p tsconfig.json` | exit 2 | exit 2 | The same 3 errors, outside this lane (below) |
| `apps/runtime` `test/*.test.mjs` + `telemetry/test/*.test.mjs` without `process.test.mjs` | 221 tests, 217 pass, 4 fail | 233 tests, 229 pass, 4 fail | The same 4 (below) |
| `apps/runtime/native-authority/test` non-`-pg` files | 327 tests, 320 pass, 7 fail | 332 tests, 325 pass, 7 fail | The same 7 (below) |

- **Control: the 9 failing files.** `lifecycle-hold-composition-pg`, `native-preparation`, `native-prepared-launch-pg`, `next-run-pg`, `prepared-execution-claim-pg`, `read-optional-pg`, `retention-serving-pg` (one test), `sequence-range-migration-pg` and `store-pg`. First error: `connect ENOENT/ECONNREFUSED /tmp/meri-broker-pg-socket-20261014/.s.PGSQL.5432`.
- **Control typecheck: the 3 errors.**
  - `worker/conversation/reads/schema.mjs` (42,30) TS2345
  - `worker/conversation/reads/schema.mjs` (43,66) TS2345
  - `worker/conversation/reads/tools.mjs` (15,24) TS7006
- **Runtime: the 4 failures.**
  - `image-closure`: `failed to connect to the docker API at unix:///var/run/docker.sock`.
  - `prepared-run-issuance-postgres-pg` ×2: `ECONNREFUSED` on the PostgreSQL socket.
  - `runner-bootstrap-files` "release removes only…": `AssertionError: cleanup failure is reported with the original failure` (actual `RUNNER_BOOTSTRAP_FILE_REFUSED`; the root-sensitive fixture).
- **Native-authority: the 7 failures.** `execution-broker` ×6 and `runnable-runtime` ×1: `ECONNREFUSED` on the PostgreSQL socket.
- **Branch counts.** The branch runtime count is before the final registry case was added. That file was rerun afterwards: 18/18.
- **`process.test.mjs`.** Run as uid 65534 with AWS variables and the extra CA removed (these tests refuse root): 7/7.
- **Focused final reruns at HEAD.** Control 45/45; runtime 107/107 across 14 files, including the prepared-candidate (hashed) and prepared-kickoff suites.
- **`scripts/qualification/local-baseline/dependency-ownership.test.mjs`**: 1/1.
- **`scripts/qualification/assembled-image/source-proof.test.mjs`**: 4/5. The manifest-row test fails at the first changed row. A full scan shows exactly 5 of 45 rows differ, all listed below. Candidate f bytes are unchanged (`3215210633…085017`). No candidate manifest was created.

### Source-proof rows changed (the lead records candidate g)

| Path | Old SHA-256 | New SHA-256 | Reason |
|---|---|---|---|
| apps/control/conversations/native-preparation-journal.mjs | b8aadcb9ca7b06cb5ad9571da5b72b1134827b7c949498a949a54dcbafb439c9 | 0297baf0a33da0241ccdae25c82f4fe4f5c8fcc5a26e9264e0eb8c21260816fa | FORECLOSED evidence, claim refusal, conversation exclusion |
| apps/control/conversations/postgres-store.mjs | e3568dd6ce0f8afafaee43a61f5e66ecda368f7f4dbebf26f9ead21674bfe920 | 2de6bce64ace8a6d2b5d0ed205f9ffb5b7ac2884d6109df19bc629b13d48c1cb | Evidence written atomically with the queued → terminal transition |
| apps/runtime/native-authority/prepared-kickoff.mjs | 3650e3af495e5a096a108c0071703012dfbaaf0e27d61e8469bd7eaf22a2d0e7 | 2cdbe486433963b6525ace3bacebfaec91de116adeb67e4b1e54e7f1067c0182 | Re-entrant stop-only retirement in reconciliation |
| apps/runtime/native-authority/remote-composition.mjs | b1e3c3e92e40103edc48c42779be55fcc51c89fe9e2ce7f4bbecc7888d0c982a | 2c4162da6af533902090d7aa2861278c892335a90b4e4a75cbae99b80ba5ab4b | Shared allocator builder; `createOriginalRetirement` |
| apps/runtime/prepared-candidate.mjs | a27377181aa678db1228c2f60832aad74084eb0cf39439125f86fad8639bb36e | 56a56689f2bf0ee365f9f1b7e479f5f5e693ae05998d9e80057c3e8da278b603 | Lazy `retire()` (stop-only) |

## Unrun checks and why

- **Real PostgreSQL**: no cluster was running (the socket path refuses connections). The scenarios here, `next-run-pg` (its expectations are unchanged: runs that left `queued` get no evidence) and the other PostgreSQL files are **UNRUN**. The foreclosure INSERT relies on the existing schema: `native_allocations` has no INSERT constraint on record shape, and the BEFORE UPDATE trigger refuses any update from `FORECLOSED`. That is a source reading, not executed SQL.
- **Real process kill, Temporal worker kill and replay, live ECS stop, grant revocation, SDK** are **UNRUN**. The crash is modelled by abandoning a process object without closing it.
- **Docker image closure** is **UNRUN** (no Docker daemon).

## Proposals for dot (contracts frozen, none edited)

- **The `FORECLOSED` allocation record and `noAuthority` reservation facts are control-internal store shapes, not frozen contracts.** Optionally, a future centrally allocated migration could add an INSERT-time shape check for `native_allocations.record`. This is not required for safety: the journal validates on read, and the trigger already freezes the row.
- **Carry forward the earlier L4 proposal**: add `ATTEMPT_LOST` as a named `run.status` reasonCode.

## Residual risks

- **Facts changed between restarts.** The stop-only owner is refused when the configured or replayed facts no longer equal the durable intent. That is an UNKNOWN barrier needing an operator.
- **CLAIMED with no discoverable task stays `ALLOCATION_UNKNOWN`.** A record that is CLAIMED with no resource and no task found by `startedBy` stays unknown, as at base.
- **The restart stop route can issue a fresh capability.** For a target that was never issued, the rebuild issues one. The capability is inert without an allocation; this is pre-existing.
- **Bounds are unchanged.** The native client caps each call at 3 s, and the broker's stop deadline is still 3 s. A slow ECS stop surfaces UNKNOWN, and the next stop or the operator one-shot resumes.
- **No index of exhausted runs.** The workflow still rethrows the original failure, so an operator finds runs needing re-entry by their nonterminal or unretired state.
- **Runs that left `queued` without a claim get no evidence.** Such a run (outside the native path) has its successor refused. This is fail-closed.
- **Repository rules.** This work was done by a Fable lane under the user's brief. The repository's AGENTS.md routes engineering to OpenAI/Codex; the user's instructions take precedence there.
