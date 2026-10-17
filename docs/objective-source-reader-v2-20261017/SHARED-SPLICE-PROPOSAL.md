# Objective protected-facts shared splice: owner review proposal

**HOLD — proposal only.** This document proposes later source changes. No shared
Meri source or existing published file was edited for this proposal.
Meri's owner requires either its coherent final first-chat pin or explicit
acceptance of a minimal patch before edits to prepared-run issuance/bindings.
This read-only inspection is not that acceptance and authorizes no mount,
credentials, grant, migration, deployment or activation.

Reviewed source dependencies:

- [Meri draft PR127](https://github.com/neo-capiro/meri-greenfield/pull/127),
  exact `d1512708859f97b6aa7369dfcc8dd9f6448de911`:
  [protected-facts APIs](https://github.com/neo-capiro/meri-greenfield/blob/d1512708859f97b6aa7369dfcc8dd9f6448de911/apps/runtime/objective-source/protected-facts.mjs)
  and [source qualification](https://github.com/neo-capiro/meri-greenfield/blob/d1512708859f97b6aa7369dfcc8dd9f6448de911/docs/objective-source-reader-v2-20261017/SOURCE-QUALIFICATION.md).
- [Core draft PR64](https://github.com/neo-capiro/capiro-backend/pull/64),
  exact `806a0939267806e7481bb2bbfe260f5a5a0794c3`:
  [default-off v2 client](https://github.com/neo-capiro/capiro-backend/blob/806a0939267806e7481bb2bbfe260f5a5a0794c3/apps/api/src/auth/workload-authority/objective-reader-v2-client.ts).
- Wire freeze remains Meri draft PR123
  `b2f0a5d71e1c1b6a6cf79b1e9a496ad663ef641a`.

Observed integration-owner checkout: `meri-runtime-integration` HEAD
`ce459f5b5491acb4b08b94b4e788ecf85341653a`. The five inspected shared paths
were clean at inspection. This is an observed local source pin, not an assertion
that the owner supplied its coherent final first-chat pin. Line references below
identify that observed source and must be rechecked at the owner-accepted pin;
they do not authorize rebasing or editing its active checkout.

## Minimal insertion and ownership

1. **`apps/runtime/prepared-run-bindings.mjs`, `createPreparedRunBindings` /
   `facts.compile` (currently line 62):** this existing trusted producer already
   reads the canonical accepted run through `o.store.readOptional`. An Objective
   producer must require that row even when `approvedReads` is absent and match
   the original request hash, seven-field binding, versions, scopes and policy.
   Supply an explicit, optional trusted `facts.decorateObjective` owner method;
   do not add Objective fields or callback/module names to browser/config JSON.
   The owning control composition must supply the genuine immutable selection:
   Core source admission, canonical typed request, execution context, selected
   seven-type Strategy value and genuinely issued provider/model selection.
   An ordinary-chat classification preserves today's path and hash. A known
   Objective source with missing/uncertain inputs must refuse, never downgrade
   itself to ordinary chat.

2. **`apps/runtime/prepared-run-issuance.mjs`, `createPreparedRunIssuance.prepare`
   (currently lines 94–97):** after the existing issuer returns real `ISSUED`
   metadata and `compilePreparedRunFacts` returns nonsecret base facts, invoke
   the optional trusted decorator before the existing immutable `bindFacts`.
   The concrete new functions are
   `compileObjectiveProtectedFacts(raw,{accepted,issuance,nowMs})` and
   `decorateObjectiveBindFactsInput({preparedFacts,pair},{accepted,issuance,nowMs})`.
   Their result is `{facts,bindFactsInput}`; pass that exact input plus the
   existing signal to the same issuer CAS, then retain today's receipt/replay,
   source-retirement and grant-reuse checks. Return the actual bound receipt
   with the final facts. No second issuance or fake pre-bound hash is needed.
   Capture the decorator as a trusted composition port rather than importing
   `protected-facts.mjs` directly here: it currently imports this file's
   canonical `parseTransport`, so a reverse import would introduce a cycle.

3. **The same file, `resolveFacts` (currently lines 116–117), and
   `apps/runtime/prepared-run-registry.mjs`, `build` (currently lines 70–72):**
   both recompile and compare the whole-facts digest. They must reuse the same
   optional-pair composition; changing only `prepare` would make every Objective
   replay fail. One proportionate API addition for owner review is an internal
   `runIssuance.recompilePreparedFacts({configuration,intent,issuance,signal})`
   facade over the same base compiler/decorator, called by both sites.
   `configuration` remains trusted memory only; the returned facts are nonsecret.
   Preserve `resolveFacts`' existing private raw configuration result for the
   allocator, and never serialize it. This facade name is proposed, not an
   already implemented/exported method.

4. **After the same CAS readback succeeds**, call the new custody owner's
   `publish({issued,signal})` with the actual final issued entry. It derives the
   binding from the independently read canonical accepted run, rechecks actual
   ISSUED metadata and current authority, and compares/stores immutable custody.
   Failure/uncertainty remains closed; successful source publication is not
   permission to dispatch. Full production custody persistence is still a
   required owner binding. Do not invoke custody publication before `bindFacts`
   or use a mapping created from caller JSON to make the pre-bind facts trusted.

## Every whole-facts reconstruction must preserve the pair

The optional pair is exactly `{objectiveGeneration,objectiveStrategy}`, present
as both fields or absent as both. It is inside the existing JCS whole-facts
digest. Never strip it, merge a newer selection, recompute it from current
Objective input, or accept an old base digest for a pair-bearing receipt.

| Exact path / function | Existing reconstruction | Needed trusted input and preserved checks |
| --- | --- | --- |
| `apps/runtime/native-authority/task-router-authority.mjs` / `verify`, line 28 | Rebuilds base facts before matching `issued.factsSha256`. | Read the original pair from immutable protected-facts/custody metadata for the already verified issuance key, full binding and facts hash. Keep control/task capability role checks, original allocation and current admission. For `stop`, preserve expired cleanup semantics; do not add an unexpired execution or public historical-read requirement. |
| `apps/runtime/native-authority/runner-poststart-authority.mjs` / `current`, line 44 | Rebuilds base facts before challenge/redemption can reach material. | Same immutable pair lookup, before whole-hash comparison. Preserve actual ECS task, allocation, ENI peer, admission, challenge and certificate checks. No capability resolution moves earlier. |
| `apps/runtime/prepared-run-bindings.mjs` / `retireInitial`, line 90 | Rebuilds base facts for existing allocator stop after restart. | Same original pair, metadata-only. Keep saved accepted request/issuance/allocation comparison. No `facts.compile`, model grant issue, capability resolution, new expiry or preparation replay just to stop an expired task. |
| `apps/runtime/prepared-run-registry.mjs` / `build`, line 71 | Calls the base compiler after private `resolveFacts`. | Use the single composed recompilation above and compare the complete final digest, preserving transport, versions, approved reads and original receipt equality. |

The issuer row currently stores the digest, not the complete pair. The new
custody contract is keyed by generation job. Router/poststart/cleanup start from
an issuance key/full binding, so the owner must supply a durable, unambiguous
lookup to that immutable original metadata (or an already owned protected-facts
record carrying it). A process-local registry is insufficient after restart.
Absence/conflict/UNKNOWN for a known Objective source must refuse; no guessed
job ID, caller-supplied pair, secret `resolveFacts` result, new migration ID or
ordinary-chat fallback is proposed. The actual persistence/index allocation
remains a concrete prerequisite for the shared splice.

`assertIssuedObjectiveProtectedFacts(issued,{accepted})` is the new pure integrity
validator for such retained metadata. It preserves expired original execution
time and grants no current authority. Cleanup uses its existing cleanup authority;
browser/internal observation uses the separately fresh native read authority.

## Accepted request and ISSUED custody cannot be synthesized

Canonical accepted request is the existing five-field durable conversation input
`{requestId,prompt,skill,window,windowRequest}` paired with its real run, not a Core
echo, generated UUID or typed-request model arguments. Only that run owns
`tenantId,actorId,conversationId,runId,attemptId,workerId,writerFence`. Original
ISSUED receipt identity and immutable facts hash come from the actual issuer's
claim/complete/bind CAS. Hash equality can compare those owners' evidence; it
cannot authenticate a caller or create missing accepted/issued records.
The selection owner must preserve the originally accepted Core request and real
model issuance, including exact selected type, rather than infer a type from
legacy nullable `typeHint` or reselect the model during replay.

One further downstream seam remains visible: `native-authority/remote-composition.mjs`
currently constructs `createNativeCompletionCapture` at line 47 without its
supported optional `preparedFacts` owner. A separate owner-approved splice must
pass the actual current prepared reader if typed completion custody is to be
recorded. This proposal does not edit that first-chat transport composition.

Acceptance should review one coherent owner pin and the small source diff across
all reconstruction paths together. Ordinary-chat fact bytes must remain exact;
Objective prepare/replay/restart/stop must retain the pair and original expiry.
PR127's published source-only composition qualification is useful evidence,
but it does not replace this owner-approved shared splice or production bindings.
No new checks, builds, installs, SQL or live actions were run for this proposal.
