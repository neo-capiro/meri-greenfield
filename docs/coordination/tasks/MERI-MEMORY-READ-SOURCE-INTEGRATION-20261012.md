# Own-pending proposal read binding: integration scope

Base: preserved PR10 `7ba0e9d10ebf684e162dcc7c143915afdbf00f32`, tree `26527e06900f4c63dc81c7d394dd50e45c4febaf`. PR10 remains a source-review checkpoint, not runtime or main-merge acceptance. This work uses a new branch and draft PR stacked on PR10.

## Purpose and canonical owners

Register the already independently accepted `list_memory_proposals` input/result family as private `memory.list_own_proposals@0.2.0`. This advances the R2 REL-02 canonical read-contract prerequisite without selecting approval semantics or requiring live authority. The existing catalog binding table owns operation composition; the existing family validator owns proposal semantics. No second registry, adapter, source connection, public export, or model loop is introduced.

The canonical original inventory retains 139 capabilities, 96 selected and 43 deferred. Exactly one selected row moves from unmapped to bound but unavailable: 14 bound unavailable and 82 selected unmapped. A derived receipt reports this change; it cannot replace the canonical catalog or inventory.

## Allocation and dependencies

- Author: `memory_author`, worktree `/workspace/meri-memory-binding-20261012`, branch `task/meri-memory-read-binding-20261012`. Exclusive ownership of private catalog/binding/resolver/composition files, the new binding test, narrowly updated mapping/cardinality expectations in three existing tests, and author task/report/evidence paths.
- Reviewer: `memory_reviewer`, worktree `/workspace/meri-memory-binding-review-20261012`, branch `review/meri-memory-read-binding-20261012`. Exclusive independent task/report/evidence paths. No production edits. Review the exact author freeze separately and return ACCEPT_SOURCE or HOLD.
- Integration: root, worktree `/workspace/meri-memory-read-source-20261012`, branch `task/meri-memory-read-source-20261012`. Own this task, integration report/evidence, current capability documentation and G1 status. Integrate only independently accepted source.

All three start at the exact preserved PR10 base. No recursive delegation. Thirty-minute soft task deadlines and bounded local checks; communicate recoverable failures promptly and retain original outcomes.

After Neo's policy decision, `gateway_author` and `gateway_reviewer` separately own policy alignment and its independent review in `/workspace/meri-memory-policy-20261012` and `/workspace/meri-memory-policy-review-20261012`, also at PR10. The approved interface is a frozen descriptive `memoryReviewPolicy` and `memoryReviewPolicyText({scope, action})` in private `retrieval-0.2/memory-review-policy.mjs`, with a new focused contract test. It accepts no role, actor, or grant input and returns no authorization decision. Its data and wording share one owner; canonical runtime enforcement stays with the actual producer. New policy task/decision/report/evidence paths are exclusive to that pair. Existing catalog, schema, family validator, public exports and source authorization are outside their edit scope.

## Interface and authority boundaries

Private contract resolution may validate a server-selected subject and retained prior request/page; these are trusted context inputs, never model arguments or authentication. The original thirteen operations must retain their context grammar and behavior. The own-pending queue remains unapproved content, never approved evidence or a general absence assertion. Existing memory schema and family validation bytes remain unchanged. Public transport 0.1 and all original inventory classifications remain unchanged.

All fourteen descriptors must remain `handler:null`, `availability:unimplemented`, `qualification:pending`, with zero retries. The production gateway stays source-disabled. Actual task authentication, current proposer/client/wall checks, authorization after resume, source pagination and release lineage still require future qualified implementations and native evidence.

Neo subsequently approved retaining the existing administrator self-approval exception. A separate author/reviewer pair now owns private policy-description and wrapper-facing wording alignment, with exact existing roles and unchanged current-authority prerequisites. No approval, rejection, withdrawal, save, or review action is implemented or enabled here. The read binding does not depend on consequential approval semantics.

## Acceptance and evidence

Preserve PR10 and original source/test snapshots. Review schema pins, exact old descriptor equality, all original ledger classifications, strict context and inert-data admission, normalization/digests, retained continuation checks, invalid timestamps, and public/private separation. Test the new binding independently, all existing contracts, source-disabled gateway composition, original deadline negative controls, public generation and types. Preserve failures and distinguish intentional mapping expectation updates from weakened tests. Record exact commits, commands, exits and owned-process absence.

No paid model/provider calls, cloud image build/push/launch, resources, credentials, security/network/database changes, customer data, frontend edits, main merge or deployment. Historical readiness and failure packets are immutable. G0 accepted; G1 OPEN; G2–G7 unentered. The parent reported that Neo separately approved the local read-only capture and metadata evidence upload and that the local coordinator resumed. That authorization is assigned to the local coordinator; no returned native artifacts are available here.
