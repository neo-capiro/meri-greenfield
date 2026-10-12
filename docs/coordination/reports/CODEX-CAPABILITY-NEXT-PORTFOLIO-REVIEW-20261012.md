# Independent Research Portfolio source review — 2026-10-12

Reviewer gateway_reviewer; isolated `review/meri-portfolio-next-20261012` at source candidate `deec763c57ba57cc4d7e7915d55b0f8719e13021`, with root canonical admission export dependency `5efbc0f24e31ce2a3a131b3955d7e3ef23b750d1` (equivalent source to root `685fe100233da10991485be49b2a1e8e31dd8308`). Read AGENTS, implementation standards, adopted R2 and `CODEX-CAPABILITY-NEXT-20261012.md`. Review owns only this report, the new independent portfolio test and `capability-next-20261012/portfolio-review/**`. No production repair, source execution, nested delegation, service/native/SQL/provider/cloud action or package acquisition is allocated.

## Criteria frozen before independent execution

1. Compare exact pinned shared DTOs, producer projection/ordering/defaults and current conversation/scope/grant/client-wall ownership against the two selected operations. Record source blob/hash metadata and derived findings only. No copied private implementation or private bodies in evidence. Keep Clio `get_research_evidence` pending under D012.
2. New Meri `{binding,subject,data}` wrappers and `{binding,subject}` context are correlation requirements, never current authority proof. Require exact actor/tenant/full run/task/fence/current conversation, one research-portfolio entity and returned portfolio identity. Reject forged model authority and cross-scope output. No authorization predicate, adapter or gateway activation is introduced.
3. Exercise actual new factory with the canonical admission helper and canonical subject/hash validation. Preserve closed input grammar, omitted conversation default, explicit conversation match, integer page limits, cursor trimming, separate detail/changes DTOs and required-null versus optional fields. No arbitrary caller cursor gains authenticity or source completeness.
4. Verify member/grant/client-link/event identities, current actor grant versus reported role, visible projected counts, event time/id ordering, page limits/continuation and recipient/event state correlation. Historical event revisions need not equal the current detail revision. Captured scope revision/digest belongs to the external trusted owner; do not invent a returned field or pretend current data validates it.
5. Preserve opaque inert event/unresolved JSON as unverified data. Reject hostile accessors/proxies/hidden/symbol/exotic/cyclic/oversized input without invoking user code. Check finite dates, safe integer boundaries, no invented proof/completeness/current-grant booleans and immutable resolver ownership boundaries. Report any intentional transport ceiling versus producer behavior.
6. Preserve original assertions and failures; use independent positive projections and meaningful mutation controls, not only helper-call assertions. Source fixes belong to the author. Replay exact final source and audit schemas/public/locks/catalog/gateway/runtime preservation. Current source-only family acceptance does not close canonical registration or missing gateway binding/subject consumption.
7. Use the supplied local subreaper capture, retain raw failures, verify owned process groups exit, and return ACCEPT_SOURCE/HOLD with exact source and ordered review-only commits. Native/runtime/source authorization remain UNRUN.

## Decision and exact source

**ACCEPT_SOURCE** for repaired author `088cfa10df8af518795a10590ce3e17c8b4fad8a`, tree `d84cd2e295d5f03f369ccad1a4ffccf2be78395c`. This decision accepts the private family only. Root registration and the missing gateway consumer of trusted binding/subject require their own integration review. No source availability or runtime gate is accepted.

The original source freeze `deec763c57ba57cc4d7e7915d55b0f8719e13021` and author metadata `c8a23acc80bfdc199f198ac11b0c90f08fe519b1` remain in ancestry. Reviewer criteria were committed at `544b57afa790c667107495ff8c4922919c88f0d6`. Frozen independent controls and the demonstrated failure were committed at `75025bd7ba069dcb36079371b29cfa733f3b55ef`. The repaired author was then merged for exact replay; root should skip that review merge when cherry-picking review-only commits.

| Accepted source | SHA256 |
| --- | --- |
| `research-portfolio-validation.mjs` (6091 bytes) | `55c006eda93cca6f51f913d70fee93b73f125c2339638eabb6574da0d867f0d2` |
| `research-portfolio.schema.json` (17893 bytes) | `cb6d881f19cd7f37561e5955a082080211f1fa69ef520f7208ace9c2e3eb41bc` |
| Root `operation-contracts.mjs` dependency (5544 bytes) | `f09b6b3a8b0186b3e2f05a17135ce40bac9ed728796493501ce7d8d4d647adfd` |

## Confirmed defect and replay

The first independent run against the original source passed 21/22 checks. It demonstrated that a one-row changes page with a non-null cursor was accepted for requested limit 2. The pinned producer first selects the visible prefix up to the limit and emits a continuation only if it has more visible rows than that limit. Thus a non-null continuation must accompany a full requested page. This was a projection-validation defect, not evidence of an authorization bypass or live source behavior.

The author changed the existing non-null cursor guard to require `items.length === selected.limit` and added one regression. Existing cursor identity/progress checks and all 24 original author assertions remain. Terminal short/empty pages remain accepted. The exact original failure, tested-source hashes and unmodified independent test remain under `portfolio-review/first-independent.*` and `first-independent-source.json`.

The unchanged independent 22 and author 25 checks pass **47/47** against the repaired source. The source/reference/preservation audit passes **80/80**. No assertion was weakened to obtain these results. Both nonempty detail and changes projections pass; the negative controls cover full actor/tenant/run/attempt/worker/fence lineage, current conversation and portfolio selection, subject substitution, role/grant correlation, duplicate identities, visible counts, required-null fields, unsupported DTO fields, recipient/event identity, event ordering, paging, nonfinite dates and revisions, hostile inputs, opaque JSON and bounded admission.

Unicode controls specifically preserve JSON Schema code-point transport bounds: a 2048-emoji cursor and 4096-emoji name pass without truncation, while an extra code point refuses. These are deliberate Meri transport limits, not claims about a producer UTF-16 truncation rule. The canonical resolver retains snapshot/freezing ownership. Standalone synchronous family normalization does not promise a frozen return or current authorization.

Exact replay commands from this review repository root:

```sh
python3 docs/qualification/candidates/capability-next-20261012/portfolio-review/capture-reaped.py repaired-independent node --test packages/contracts/test/retrieval-research-portfolio-independent.test.mjs packages/contracts/test/retrieval-research-portfolio.test.mjs
python3 docs/qualification/candidates/capability-next-20261012/portfolio-review/capture-reaped.py source-audit python3 -I -B -S docs/qualification/candidates/capability-next-20261012/portfolio-review/audit-source.py /workspace/capirov2
```

Capture labels are write-once; a later replay must use a fresh label. The audit is a local immutable-source read, not Capiro execution or an API call. One preliminary ad hoc inspection selector raised `ValueError` because it assumed a method spelling; an earlier exact-string projection probe also missed the nested count override. Corrected structural inspection and the executable audit establish the actual relationships. Those reconnaissance issues were not product failures, and no source conclusion was based on them.

## Independent reference findings

The audit independently verifies all 16 referenced immutable blobs at Capiro `fd8765ec01d292013758606204f2c9d886cd31c1` against byte counts/SHA256s and observed `4be13b0b1ed0f2f3fa014040eedbb2fc2c27dace`. All 16 are unchanged. Output records only hashes, paths and derived checks. No private implementation is imported or executed and no private body is included in the report or raw check evidence.

The shared detail, grant, client-link, member, event and recipient-state DTO field sets/requiredness and seven enum sets match the new schema. `origin` is optional; nullable projected fields remain required. The producer count for members is the database member count while the detail query returns all members. Client-link count is overridden with the visible-link projection length. Neither count establishes an unmasked global enumeration. The actor's reported role comes from its explicit portfolio grant; owner identity alone supplies no grant.

The trusted source path resolves the caller's current, nonarchived conversation using conversation ID, tenant and actor before authorizing its stored portfolio scope. The portfolio access owner requires current tenant-scoped actor grants. Detail/changes producers mask denied client references, including historical events. Relevant existing tests describe withdrawn grants, cross-tenant refusal, wall masking, revoked membership, current-turn injection and invalid scope attempts. Those private tests were inspected as references and were not executed here.

The scope owner retains the captured scope digest/revision separately and compares current versus captured portfolio revision. The detail DTO reports the current revision; event revisions remain historical. The new family must not manufacture captured-scope fields, equalize event and detail revisions, or treat matching caller-supplied context as evidence that the external scope owner ran. It correctly leaves those checks outside this family. Likewise event recipient state is correlated to the current actor and event, but this is not live recipient authorization.

Changes order is descending timestamp then ID after denied-client masking. Its cursor names the last returned visible event; a null cursor or empty page is not promoted to complete history or global absence. Detail recent history has a 100-event ceiling. Payload and unresolved-input interiors remain bounded inert JSON; reported `approved`, `complete` or other text inside them cannot establish authority. Structural proof/authorization/completeness fields are refused.

`get_research_evidence` remains unsupported by this family. Its pinned producer/reference tests concern actor-owned Clio attachment snapshots with source/current-text and client-wall checks. Mapping it as portfolio evidence would alter the accepted D012 owner/scope and requires a separate decision. No such decision or implementation is part of this acceptance.

## Preservation, cleanup and limits

At the accepted author commit, 5,054/5,055 original tracked files are unchanged from `e0163fb65a639a28d9423e929058b40b48cc556d`. The sole existing-file change is root's canonical inert admission export, byte-identical to `685fe100233da10991485be49b2a1e8e31dd8308`. Original schemas, tests, loader/catalog, public 0.1 exports, locks, 139-capability ledger, gateway, proxy, runtime, scripts and infrastructure remain unchanged in this author lane. The new family reuses one canonical admission owner and contains no source adapter, authorization engine or competing model loop.

Reviewer process groups 137860 (initial failure), 138492 (47-check replay) and 138683 (source audit) are absent. No timeout, kill or orphan reaping was required; exact raw streams and subreaper receipts are preserved. No other owner's process was touched.

Live source projection fidelity, current conversation/scope receipt ownership, current grants/client walls, cursor authority, release-time checks, actual gateway context consumption, budgets, durability and native/runtime qualification are **UNRUN**. No SQL, provider/model, cloud, native fixture, customer data, frontend, network acquisition or service action occurred. Family source acceptance does not establish those properties. Connectivity remains disabled, G1 remains OPEN, and G2–G7 remain unentered.
