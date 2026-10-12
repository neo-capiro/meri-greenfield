# Memory proposal read binding — author return

**SOURCE_ONLY_RETURN_FOR_INDEPENDENT_REVIEW.** Base:
`7ba0e9d10ebf684e162dcc7c143915afdbf00f32`; branch
`task/meri-memory-read-binding-20261012`; worktree
`/workspace/meri-memory-binding-20261012`. The earlier timestamp repair branch
and worktree are preserved. See the
[pre-edit task outline](../tasks/MERI-MEMORY-READ-BINDING-20261012.md).

## Result and module ownership

The canonical private catalog now binds
`list_memory_proposals` to `memory.list_own_proposals@0.2.0`, using the existing
memory schema and validators unchanged. Catalog version advances from `0.2.1`
to `0.2.2`; operation/private schema versions remain `0.2.0`, and public `0.1.0`
remains unchanged. All 139 original IDs, dispositions and boundary text remain;
96 selected / 43 deferred now means **14 bound but unavailable / 82 selected
unmapped**. The earlier 13 descriptors and binding definitions are unchanged.

`catalog-validation.mjs` remains the only operation binding registry.
`operation-contracts.mjs` uses optional frozen `contextKeys` from that registry.
Only the new memory binding specifies `subject` and optional retained
`previous:{request,page}`. The prior 13 bindings still admit exactly their
existing `nowMs`, `actorId`, `previousPage` grammar; output also requires
`request`. Memory rejects those legacy keys and model-supplied authority keys.
`validate.mjs` composes the already-existing family into the canonical resolver.
There is no duplicate schema, validator, source adapter or new module.

Normalization returns a detached, deeply frozen original request, effective
selection (`clientId`, `cursor`, `limit`), canonical selection digest and null
metadata. Output requires original request plus current trusted subject and
any retained previous state. The family still owns actor/tenant/client
matching, limit/cursor continuity, finite timestamps, descending order,
redaction and coverage. This is structural contract validation; it cannot
authenticate a subject or prove that a caller supplied its actual original
request. The future trusted gateway must provide and retain that authority.

The descriptor's authoritative enumeration declaration concerns pending queue
status only. Proposal text remains unapproved; every classification has
`claimsAreApprovedFacts:false`, `evidenceReady:false` and
`negativeAssertion:'none'`. Empty/complete do not establish fact absence.
All 14 descriptors remain null-handler, unimplemented, pending and zero-retry.
No operation becomes callable, and source connectivity remains disabled.

## Verification and preserved failures

| Check | Outcome |
| --- | --- |
| Original mapping expectations against new catalog, before intentional updates | 67/70 pass; three expected count/unmapped failures retained |
| Focused binding/catalog/memory/mail suites | 82/82 pass, including 12 new binding groups |
| Root `npm run check` | 232/232 pass (contracts plus existing Hermes-session source tests) |
| Public distribution | Generated-byte check, strict typecheck and 7/7 public tests pass |
| Existing gateway suites against expanded catalog | 34/34 pass; gateway source unchanged |
| Source whitespace and preservation | Staged diff check passes; preservation checks pass |

Every invocation has a separate immutable raw stdout/stderr pair and receipt
with exact command, exit, source diff hash, time bound, owned PID/process group
and final group absence. The root, public and gateway runs bind source diff
SHA-256 `d6ece75280006bd29f30974a9ffc4633fac07522fb7eb1c59117d193d57b5b30`.
The earlier focused capture preceded staging the new test, so its Git diff hash
does not include that then-untracked file; the final root run includes it and
the final source manifest records its bytes. No failing check was overwritten.

The three intentional existing-test changes are only catalog count/mapping
expectations and corresponding descriptions. The parent explicitly allocated
the additional mail test cardinality change after discovery. Original test
and source baselines are archived byte-for-byte. The preservation script
reconstructs each changed existing test from its exact allowed replacements
and verifies all other bytes; 48 other tracked contract/root dependency files
are unchanged. Original 13 descriptor objects and binding definitions are
unchanged. Family schema/validator, all public artifacts, locks and dependency
versions are untouched. See
[preservation](../../qualification/candidates/memory-read-binding-20261012/author/preservation.json),
[originals](../../qualification/candidates/memory-read-binding-20261012/author/originals.json)
and [artifact index](../../qualification/candidates/memory-read-binding-20261012/author/artifact-index.json).

Exact root/contract lock installation used `npm ci --ignore-scripts` and owned
cache `/tmp/meri-memory-binding-npm-cache-20261012`. Both exited zero. Npm's
version-update notices are retained; no update was performed. The adapted
existing capture helper imposed a 240-second deadline, reaped only owned
descendants, and verified every owned process group absent. No kill or timeout
was required. No background service was created.

## Policy decision and remaining gates

Neo's new explicit decision, relayed by the parent during this task, retains
the existing administrator self-approval exception without broadening roles or
privileges; nonqualifying actors still require another reviewer. The policy
decision is resolved. Enforcement alignment and runtime qualification remain
separate work. This read binding introduces no approval/review/write action.

The unchanged family validator contains historical comments saying it is
unregistered and that approval policy is unresolved. The new canonical binding
and explicit decision above supersede those comments; its bytes were preserved
as assigned, and the parent owns the separate policy alignment. Historical
evidence remains immutable. No private producer body was copied or published.

Independent source review and root integration acceptance remain required.
Current actor/source authorization, live row ownership, snapshots, source
receipts, grant expiry/revocation, native/runtime/G1 and release gates were not
run or accepted. No paid model, cloud/provider/customer-data, database,
security/network, frontend, Hermes worker, deployment, publication or merge
action occurred. Dependency package download was the only external action.
